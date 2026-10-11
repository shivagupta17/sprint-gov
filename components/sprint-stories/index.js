import {html, css, nothing, isServer} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {icon} from '@servicenow/aiux/aiux-directive-icon';
import {tooltip} from '@servicenow/aiux/aiux-directive-tooltip';

const STORAGE_KEY = 'aiux_sprint_stories_columns';

const ALL_COLUMNS = [
  {id: 'number', label: 'Number', required: true},
  {id: 'short_description', label: 'Short description', required: true},
  {id: 'epic', label: 'Epic', required: false},
  {id: 'story_points', label: 'Points', required: false},
  {id: 'assigned_to', label: 'Assigned to', required: false},
  {id: 'priority', label: 'Priority', required: false},
  {id: 'state', label: 'State', required: false}
];

const DEFAULT_COLUMNS = ['number', 'short_description', 'epic', 'story_points', 'assigned_to'];

function getColumnLabel(id) {
  switch (id) {
    case 'number': return i18n.getMessage('Number');
    case 'short_description': return i18n.getMessage('Short description');
    case 'epic': return i18n.getMessage('Epic');
    case 'story_points': return i18n.getMessage('Points');
    case 'assigned_to': return i18n.getMessage('Assigned to');
    case 'priority': return i18n.getMessage('Priority');
    case 'state': return i18n.getMessage('State');
    default: return id;
  }
}

function getInitialColumns() {
  if (isServer) return DEFAULT_COLUMNS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (_e) {
    // Ignore storage parse errors
  }
  return DEFAULT_COLUMNS;
}

@customElement('aiux-sprint-stories')
export default class SprintStories extends AIUXElement {
  @property({attribute: false}) server = null;
  @property({type: String, attribute: 'sprint-id'}) sprintId = '';
  @property({type: String, attribute: 'group-id'}) groupId = '';
  @property({type: Boolean, attribute: 'is-draft'}) isDraft = true;

  @state() loading = true;
  @state() error = '';
  @state() backlogStories = [];
  @state() sprintStories = [];
  @state() assignees = [];
  @state() epics = [];

  // Collapsible sections
  @state() sprintCollapsed = false;
  @state() backlogCollapsed = false;

  // Personalized columns
  @state() visibleColumns = getInitialColumns();
  @state() personalizeModalOpen = false;
  @state() selectedColumns = [...getInitialColumns()];

  // Filters
  @state() searchKeyword = '';
  @state() filterEpic = '';
  @state() filterAssignee = '';

  // Drag and Drop
  @state() draggedStoryId = null;
  @state() draggedFrom = null; // 'backlog' | 'sprint'
  @state() dropTarget = null; // 'backlog' | 'sprint' | null
  @state() movingStoryId = null;

  // Create Story Modal
  @state() createModalOpen = false;
  @state() createTarget = 'backlog'; // 'backlog' | 'sprint'
  @state() newShortDescription = '';
  @state() newDescription = '';
  @state() newStoryPoints = '';
  @state() newAssignedTo = '';
  @state() newEpic = '';
  @state() newPriority = '3';
  @state() creatingStory = false;
  @state() createError = '';

  static styles = css`
    :host {
      display: block;
    }
    .dropzone-active {
      outline: 2px dashed var(--color-primary, #0f62fe);
      outline-offset: -2px;
      background-color: var(--color-base-200, #f2f2f2);
    }
    .story-row-dragging {
      opacity: 0.35;
    }
    .story-table tr:hover td {
      background-color: var(--color-base-200, #f2f2f2);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (this.sprintId) {
      this.loadStories();
    }
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has('sprintId') && this.sprintId) {
      this.loadStories();
    }
  }

  async loadStories() {
    if (!this.server || !this.sprintId) return;
    this.loading = true;
    this.error = '';
    try {
      const response = await this.server.get({
        action: 'get_stories',
        sysId: this.sprintId
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not load stories.'));
      this.backlogStories = response?.backlogStories || [];
      this.sprintStories = response?.sprintStories || [];
      this.assignees = response?.filterOptions?.assignees || [];
      this.epics = response?.filterOptions?.epics || [];
    } catch (err) {
      this.error = err?.message || i18n.getMessage('Could not load stories.');
    } finally {
      this.loading = false;
    }
  }

  // --- Drag and Drop Handlers ---
  handleDragStart(event, storyId, source) {
    this.draggedStoryId = storyId;
    this.draggedFrom = source;
    event.dataTransfer.setData('text/plain', storyId);
    event.dataTransfer.effectAllowed = 'move';
  }

  handleDragOver(event, target) {
    event.preventDefault();
    if (this.draggedFrom && this.draggedFrom !== target) {
      this.dropTarget = target;
      event.dataTransfer.dropEffect = 'move';
    }
  }

  handleDragLeave(event, target) {
    if (this.dropTarget === target) {
      this.dropTarget = null;
    }
  }

  async handleDrop(event, target) {
    event.preventDefault();
    const storyId = this.draggedStoryId || event.dataTransfer.getData('text/plain');
    const source = this.draggedFrom;
    this.dropTarget = null;
    this.draggedStoryId = null;
    this.draggedFrom = null;

    if (!storyId || source === target) return;

    const targetSprint = target === 'sprint' ? this.sprintId : '';
    await this.moveStory(storyId, targetSprint);
  }

  async moveStory(storyId, targetSprint) {
    if (this.movingStoryId || !this.server) return;
    this.movingStoryId = storyId;
    this.error = '';
    try {
      const response = await this.server.get({
        action: 'move_story',
        sysId: this.sprintId,
        storyId,
        targetSprint
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not update story.'));
      this.backlogStories = response?.backlogStories || this.backlogStories;
      this.sprintStories = response?.sprintStories || this.sprintStories;
      this.dispatchEvent(new CustomEvent('stories-updated', {
        bubbles: true,
        composed: true,
        detail: {sprint: response?.sprint}
      }));
    } catch (err) {
      this.error = err?.message || i18n.getMessage('Could not update story.');
    } finally {
      this.movingStoryId = null;
    }
  }

  async handleAssignStory(storyId, assignedTo) {
    await this.updateStoryField(storyId, 'assigned_to', assignedTo);
  }

  async updateStoryField(storyId, field, value) {
    if (!this.server || !this.sprintId) return;
    this.error = '';
    try {
      const response = await this.server.get({
        action: 'update_story',
        sysId: this.sprintId,
        storyId,
        field,
        value
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not update story.'));
      this.backlogStories = response?.backlogStories || this.backlogStories;
      this.sprintStories = response?.sprintStories || this.sprintStories;
      this.epics = response?.filterOptions?.epics || this.epics;
      this.dispatchEvent(new CustomEvent('stories-updated', {
        bubbles: true,
        composed: true,
        detail: {sprint: response?.sprint}
      }));
    } catch (err) {
      this.error = err?.message || i18n.getMessage('Could not update story.');
    }
  }

  // --- Personalize Columns Modal ---
  openPersonalizeModal() {
    this.selectedColumns = [...this.visibleColumns];
    this.personalizeModalOpen = true;
  }

  closePersonalizeModal() {
    this.personalizeModalOpen = false;
  }

  handleToggleColumn(columnId) {
    if (columnId === 'number' || columnId === 'short_description') return; // required columns
    if (this.selectedColumns.includes(columnId)) {
      this.selectedColumns = this.selectedColumns.filter(c => c !== columnId);
    } else {
      this.selectedColumns = [...this.selectedColumns, columnId];
    }
  }

  savePersonalizedColumns() {
    this.visibleColumns = [...this.selectedColumns];
    if (!isServer) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.visibleColumns));
      } catch (_e) {
        // Ignore storage errors
      }
    }
    this.personalizeModalOpen = false;
  }

  resetPersonalizedColumns() {
    this.selectedColumns = [...DEFAULT_COLUMNS];
    this.visibleColumns = [...DEFAULT_COLUMNS];
    if (!isServer) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_e) {
        // Ignore storage errors
      }
    }
    this.personalizeModalOpen = false;
  }

  // --- Create Story ---
  openCreateModal(target = 'backlog') {
    this.createTarget = target;
    this.newShortDescription = '';
    this.newDescription = '';
    this.newStoryPoints = '';
    this.newAssignedTo = '';
    this.newEpic = '';
    this.newPriority = '3';
    this.createError = '';
    this.createModalOpen = true;
  }

  closeCreateModal() {
    this.createModalOpen = false;
  }

  async handleCreateStory(event) {
    event.preventDefault();
    const shortDesc = this.newShortDescription.trim();
    if (!shortDesc) {
      this.createError = i18n.getMessage('Please enter a short description.');
      return;
    }

    this.creatingStory = true;
    this.createError = '';
    try {
      const response = await this.server.get({
        action: 'create_story',
        sysId: this.sprintId,
        short_description: shortDesc,
        description: this.newDescription.trim(),
        story_points: this.newStoryPoints,
        target: this.createTarget,
        assigned_to: this.newAssignedTo,
        epic: this.newEpic,
        priority: this.newPriority
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not create story.'));
      this.backlogStories = response?.backlogStories || this.backlogStories;
      this.sprintStories = response?.sprintStories || this.sprintStories;
      this.epics = response?.filterOptions?.epics || this.epics;
      this.createModalOpen = false;
      this.dispatchEvent(new CustomEvent('stories-updated', {
        bubbles: true,
        composed: true,
        detail: {sprint: response?.sprint}
      }));
    } catch (err) {
      this.createError = err?.message || i18n.getMessage('Could not create story.');
    } finally {
      this.creatingStory = false;
    }
  }

  // --- Filtering ---
  filterList(stories) {
    const kw = this.searchKeyword.toLowerCase().trim();
    return stories.filter(story => {
      if (kw) {
        const matchesNum = (story.number || '').toLowerCase().includes(kw);
        const matchesDesc = (story.short_description || '').toLowerCase().includes(kw);
        if (!matchesNum && !matchesDesc) return false;
      }
      if (this.filterEpic && story.epic !== this.filterEpic) return false;
      if (this.filterAssignee && story.assigned_to !== this.filterAssignee) return false;
      return true;
    });
  }

  calculatePoints(stories) {
    return stories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);
  }

  isColVisible(id) {
    return this.visibleColumns.includes(id);
  }

  renderSkeletonTable() {
    return html`
      <div class="space-y-2 p-3">
        <div class="aiux-skeleton h-10 w-full rounded"></div>
        <div class="aiux-skeleton h-10 w-full rounded"></div>
        <div class="aiux-skeleton h-10 w-full rounded"></div>
      </div>
    `;
  }

  renderStoryTable(stories, source) {
    if (this.loading) return this.renderSkeletonTable();

    if (stories.length === 0) {
      return html`
        <div class="flex flex-col items-center justify-center p-8 text-center text-text-secondary border-2 border-dashed border-base-300 rounded-box m-3 min-h-36">
          <p class="text-sm font-medium">
            ${source === 'sprint' ? i18n.getMessage('No stories in this sprint.') : i18n.getMessage('No backlog stories found.')}
          </p>
          <p class="text-xs mt-1 text-text-secondary">
            ${source === 'sprint' ? i18n.getMessage('Drag backlog stories here or click + to add.') : i18n.getMessage('Click + to create a new backlog story.')}
          </p>
        </div>
      `;
    }

    return html`
      <div class="overflow-x-auto">
        <table class="aiux-table aiux-table-sm w-full story-table">
          <thead>
            <tr class="border-b border-base-300 bg-base-200/40 text-xs">
              <!-- Drag Handle & Gear Icon Column Header -->
              <th scope="col" class="w-12 text-center p-2">
                <button
                  class="aiux-btn aiux-btn-ghost aiux-btn-xs border border-base-300 rounded p-1 inline-flex items-center justify-center hover:bg-base-200"
                  type="button"
                  aria-label=${i18n.getMessage('Personalize columns')}
                  ${tooltip({content: i18n.getMessage('Personalize list columns')})}
                  @click=${this.openPersonalizeModal}
                >
                  ${icon({name: 'gear', size: 'xs'})}
                </button>
              </th>
              ${this.isColVisible('number') ? html`<th scope="col" class="py-2.5 px-3 text-left font-semibold text-text-primary whitespace-nowrap">${i18n.getMessage('Number')}</th>` : nothing}
              ${this.isColVisible('short_description') ? html`<th scope="col" class="py-2.5 px-3 text-left font-semibold text-text-primary">${i18n.getMessage('Short description')}</th>` : nothing}
              ${this.isColVisible('epic') ? html`<th scope="col" class="py-2.5 px-3 text-left font-semibold text-text-primary whitespace-nowrap">${i18n.getMessage('Epic')}</th>` : nothing}
              ${this.isColVisible('story_points') ? html`<th scope="col" class="py-2.5 px-3 text-right font-semibold text-text-primary whitespace-nowrap">${i18n.getMessage('Points')}</th>` : nothing}
              ${this.isColVisible('assigned_to') ? html`<th scope="col" class="py-2.5 px-3 text-left font-semibold text-text-primary whitespace-nowrap">${i18n.getMessage('Assigned to')}</th>` : nothing}
              ${this.isColVisible('priority') ? html`<th scope="col" class="py-2.5 px-3 text-left font-semibold text-text-primary whitespace-nowrap">${i18n.getMessage('Priority')}</th>` : nothing}
              ${this.isColVisible('state') ? html`<th scope="col" class="py-2.5 px-3 text-left font-semibold text-text-primary whitespace-nowrap">${i18n.getMessage('State')}</th>` : nothing}
              <th scope="col" class="w-14 text-center py-2.5 px-2 font-semibold text-text-primary whitespace-nowrap">${i18n.getMessage('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${stories.map(story => {
              const isMoving = this.movingStoryId === story.sys_id;
              return html`
                <tr
                  class="border-b border-base-200 transition-colors ${isMoving ? 'story-row-dragging' : ''}"
                  draggable="true"
                  @dragstart=${e => this.handleDragStart(e, story.sys_id, source)}
                >
                  <!-- Drag Grip Handle -->
                  <td class="w-12 text-center p-2 align-middle">
                    <div class="inline-flex items-center text-text-secondary cursor-grab active:cursor-grabbing" title=${i18n.getMessage('Drag to move')}>
                      ${icon({name: 'drag-dots', size: 'sm'})}
                    </div>
                  </td>

                  <!-- Number -->
                  ${this.isColVisible('number') ? html`
                    <td class="py-2.5 px-3 font-semibold text-primary whitespace-nowrap align-middle">
                      <span>${story.number}</span>
                    </td>
                  ` : nothing}

                  <!-- Short Description -->
                  ${this.isColVisible('short_description') ? html`
                    <td class="py-1 px-3 text-text-primary align-middle max-w-md">
                      <input
                        type="text"
                        class="aiux-input aiux-input-xs w-full bg-transparent hover:bg-base-200 focus:bg-base-100 border border-transparent hover:border-base-300 focus:border-primary text-text-primary text-sm font-normal rounded px-2 py-1 transition-colors"
                        aria-label=${i18n.getMessage('Short description for {0}', [story.number])}
                        .value=${story.short_description || ''}
                        draggable="false"
                        @dragstart=${e => { e.preventDefault(); e.stopPropagation(); }}
                        @change=${e => this.updateStoryField(story.sys_id, 'short_description', e.target.value)}
                      />
                    </td>
                  ` : nothing}

                  <!-- Epic -->
                  ${this.isColVisible('epic') ? html`
                    <td class="py-1 px-3 text-text-secondary whitespace-nowrap align-middle">
                      <label class="inline-flex items-center min-w-0">
                        <span class="sr-only">${i18n.getMessage('Epic for {0}', [story.number])}</span>
                        <select
                          class="aiux-select aiux-select-xs h-7 min-h-7 py-0 px-2 text-xs bg-base-200 border border-base-300 rounded cursor-pointer max-w-36 truncate"
                          aria-label=${i18n.getMessage('Epic for {0}', [story.number])}
                          .value=${story.epic || ''}
                          draggable="false"
                          @dragstart=${e => { e.preventDefault(); e.stopPropagation(); }}
                          @change=${e => this.updateStoryField(story.sys_id, 'epic', e.target.value)}
                        >
                          <option value="">${i18n.getMessage('None')}</option>
                          ${this.epics.map(ep => html`<option value=${ep.id} ?selected=${story.epic === ep.id}>${ep.name}</option>`)}
                        </select>
                      </label>
                    </td>
                  ` : nothing}

                  <!-- Story Points -->
                  ${this.isColVisible('story_points') ? html`
                    <td class="py-1 px-3 text-right whitespace-nowrap align-middle">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        class="aiux-input aiux-input-xs w-16 text-right tabular-nums bg-base-200 border border-base-300 rounded h-7 px-2 font-medium"
                        aria-label=${i18n.getMessage('Story points for {0}', [story.number])}
                        .value=${story.story_points || '0'}
                        draggable="false"
                        @dragstart=${e => { e.preventDefault(); e.stopPropagation(); }}
                        @change=${e => this.updateStoryField(story.sys_id, 'story_points', e.target.value)}
                      />
                    </td>
                  ` : nothing}

                  <!-- Assigned to -->
                  ${this.isColVisible('assigned_to') ? html`
                    <td class="py-1 px-3 align-middle whitespace-nowrap">
                      <label class="inline-flex items-center min-w-0">
                        <span class="sr-only">${i18n.getMessage('Assignee for {0}', [story.number])}</span>
                        <select
                          class="aiux-select aiux-select-xs h-7 min-h-7 py-0 px-2 text-xs bg-base-200 border border-base-300 rounded cursor-pointer max-w-40 truncate"
                          aria-label=${i18n.getMessage('Assignee for {0}', [story.number])}
                          .value=${story.assigned_to || ''}
                          draggable="false"
                          @dragstart=${e => { e.preventDefault(); e.stopPropagation(); }}
                          @change=${e => this.updateStoryField(story.sys_id, 'assigned_to', e.target.value)}
                        >
                          <option value="">${i18n.getMessage('Unassigned')}</option>
                          ${this.assignees.map(u => html`<option value=${u.id} ?selected=${story.assigned_to === u.id}>${u.name}</option>`)}
                        </select>
                      </label>
                    </td>
                  ` : nothing}

                  <!-- Priority -->
                  ${this.isColVisible('priority') ? html`
                    <td class="py-1 px-3 text-text-secondary whitespace-nowrap align-middle">
                      <label class="inline-flex items-center min-w-0">
                        <span class="sr-only">${i18n.getMessage('Priority for {0}', [story.number])}</span>
                        <select
                          class="aiux-select aiux-select-xs h-7 min-h-7 py-0 px-2 text-xs bg-base-200 border border-base-300 rounded cursor-pointer max-w-32 truncate"
                          aria-label=${i18n.getMessage('Priority for {0}', [story.number])}
                          .value=${story.priority || '3'}
                          draggable="false"
                          @dragstart=${e => { e.preventDefault(); e.stopPropagation(); }}
                          @change=${e => this.updateStoryField(story.sys_id, 'priority', e.target.value)}
                        >
                          <option value="1" ?selected=${story.priority === '1'}>${i18n.getMessage('1 - Critical')}</option>
                          <option value="2" ?selected=${story.priority === '2'}>${i18n.getMessage('2 - High')}</option>
                          <option value="3" ?selected=${story.priority === '3'}>${i18n.getMessage('3 - Moderate')}</option>
                          <option value="4" ?selected=${story.priority === '4'}>${i18n.getMessage('4 - Low')}</option>
                        </select>
                      </label>
                    </td>
                  ` : nothing}

                  <!-- State -->
                  ${this.isColVisible('state') ? html`
                    <td class="py-1 px-3 text-text-secondary whitespace-nowrap align-middle">
                      <label class="inline-flex items-center min-w-0">
                        <span class="sr-only">${i18n.getMessage('State for {0}', [story.number])}</span>
                        <select
                          class="aiux-select aiux-select-xs h-7 min-h-7 py-0 px-2 text-xs bg-base-200 border border-base-300 rounded cursor-pointer max-w-36 truncate"
                          aria-label=${i18n.getMessage('State for {0}', [story.number])}
                          .value=${story.state || '-6'}
                          draggable="false"
                          @dragstart=${e => { e.preventDefault(); e.stopPropagation(); }}
                          @change=${e => this.updateStoryField(story.sys_id, 'state', e.target.value)}
                        >
                          <option value="-6" ?selected=${story.state === '-6'}>${i18n.getMessage('Draft')}</option>
                          <option value="1" ?selected=${story.state === '1'}>${i18n.getMessage('Ready')}</option>
                          <option value="2" ?selected=${story.state === '2'}>${i18n.getMessage('Work in progress')}</option>
                          <option value="-7" ?selected=${story.state === '-7'}>${i18n.getMessage('Ready for testing')}</option>
                          <option value="-8" ?selected=${story.state === '-8'}>${i18n.getMessage('Testing')}</option>
                          <option value="3" ?selected=${story.state === '3'}>${i18n.getMessage('Complete')}</option>
                          <option value="4" ?selected=${story.state === '4'}>${i18n.getMessage('Cancelled')}</option>
                        </select>
                      </label>
                    </td>
                  ` : nothing}

                  <!-- Actions -->
                  <td class="w-14 text-center py-2 px-2 align-middle">
                    ${source === 'backlog' ? html`
                      <button
                        class="aiux-btn aiux-btn-ghost aiux-btn-xs aiux-btn-circle"
                        type="button"
                        aria-label=${i18n.getMessage('Add {0} to sprint', [story.number])}
                        ${tooltip({content: i18n.getMessage('Add to Sprint')})}
                        @click=${() => this.moveStory(story.sys_id, this.sprintId)}
                        ?disabled=${Boolean(this.movingStoryId)}
                      >
                        ${icon({name: 'arrow-right', size: 'xs'})}
                      </button>
                    ` : html`
                      <button
                        class="aiux-btn aiux-btn-ghost aiux-btn-xs aiux-btn-circle"
                        type="button"
                        aria-label=${i18n.getMessage('Move {0} to backlog', [story.number])}
                        ${tooltip({content: i18n.getMessage('Move to Backlog')})}
                        @click=${() => this.moveStory(story.sys_id, '')}
                        ?disabled=${Boolean(this.movingStoryId)}
                      >
                        ${icon({name: 'arrow-left', size: 'xs'})}
                      </button>
                    `}
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  render() {
    const filteredBacklog = this.filterList(this.backlogStories);
    const filteredSprint = this.filterList(this.sprintStories);
    const backlogPoints = this.calculatePoints(filteredBacklog);
    const sprintPoints = this.calculatePoints(filteredSprint);

    return html`
      <div class="mt-6 flex flex-col gap-4">
        <!-- Filter and Action Bar -->
        <div class="aiux-card p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-1 flex-wrap items-center gap-3">
              <label class="flex min-w-44 flex-1 items-center gap-1.5">
                <span class="sr-only">${i18n.getMessage('Search stories')}</span>
                <input
                  type="search"
                  class="aiux-input aiux-input-sm w-full"
                  placeholder=${i18n.getMessage('Search stories by number or text…')}
                  .value=${this.searchKeyword}
                  @input=${e => { this.searchKeyword = e.target.value; }}
                />
              </label>

              ${this.epics.length ? html`
                <label class="flex items-center gap-1.5">
                  <span class="sr-only">${i18n.getMessage('Filter by Epic')}</span>
                  <select
                    class="aiux-select aiux-select-sm"
                    .value=${this.filterEpic}
                    @change=${e => { this.filterEpic = e.target.value; }}
                  >
                    <option value="">${i18n.getMessage('All Epics')}</option>
                    ${this.epics.map(ep => html`<option value=${ep.id}>${ep.name}</option>`)}
                  </select>
                </label>
              ` : nothing}

              ${this.assignees.length ? html`
                <label class="flex items-center gap-1.5">
                  <span class="sr-only">${i18n.getMessage('Filter by Assignee')}</span>
                  <select
                    class="aiux-select aiux-select-sm"
                    .value=${this.filterAssignee}
                    @change=${e => { this.filterAssignee = e.target.value; }}
                  >
                    <option value="">${i18n.getMessage('All Assignees')}</option>
                    ${this.assignees.map(u => html`<option value=${u.id}>${u.name}</option>`)}
                  </select>
                </label>
              ` : nothing}

              ${(this.searchKeyword || this.filterEpic || this.filterAssignee) ? html`
                <button
                  class="aiux-btn aiux-btn-ghost aiux-btn-sm"
                  type="button"
                  @click=${() => {
                    this.searchKeyword = '';
                    this.filterEpic = '';
                    this.filterAssignee = '';
                  }}
                >
                  ${i18n.getMessage('Clear filters')}
                </button>
              ` : nothing}
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                class="aiux-btn aiux-btn-secondary aiux-btn-sm inline-flex items-center gap-1.5 ps-2.5 pe-3.5"
                type="button"
                @click=${() => this.openCreateModal('backlog')}
              >${icon({name: 'plus', size: 'sm'})}<span>${i18n.getMessage('New Story')}</span></button>
            </div>
          </div>
        </div>

        ${this.error ? html`
          <div class="aiux-alert aiux-alert-error" role="alert">
            <span>${this.error}</span>
          </div>
        ` : nothing}

        <!-- Dual Story Sections: Sprint Stories & Backlog Stories -->
        <div class="flex flex-col gap-6">
          <!-- Sprint Stories Section -->
          <section
            class="aiux-card flex flex-col transition-all duration-[var(--duration-sm,150ms)] ${this.dropTarget === 'sprint' ? 'dropzone-active' : ''}"
            aria-labelledby="sprint-stories-heading"
            @dragover=${e => this.handleDragOver(e, 'sprint')}
            @dragleave=${e => this.handleDragLeave(e, 'sprint')}
            @drop=${e => this.handleDrop(e, 'sprint')}
          >
            <div class="flex items-center justify-between border-b border-base-300 px-4 py-3 bg-base-200 rounded-t-box">
              <div class="flex items-center gap-2 min-w-0">
                <h2 id="sprint-stories-heading" class="text-base font-semibold text-text-primary truncate">
                  ${i18n.getMessage('Sprint Stories')}
                </h2>
                <span class="aiux-badge aiux-badge-sm aiux-badge-primary">
                  ${filteredSprint.length}
                </span>
                <span class="text-xs text-text-secondary tabular-nums">
                  (${sprintPoints} ${i18n.getMessage('pts')})
                </span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  class="aiux-btn aiux-btn-ghost aiux-btn-xs"
                  type="button"
                  aria-label=${i18n.getMessage('Create story in sprint')}
                  ${tooltip({content: i18n.getMessage('Add story to sprint')})}
                  @click=${() => this.openCreateModal('sprint')}
                >
                  ${icon({name: 'plus', size: 'xs'})}
                </button>
                <button
                  class="aiux-btn aiux-btn-ghost aiux-btn-xs aiux-btn-circle"
                  type="button"
                  aria-expanded=${String(!this.sprintCollapsed)}
                  aria-label=${this.sprintCollapsed ? i18n.getMessage('Expand sprint stories') : i18n.getMessage('Collapse sprint stories')}
                  ${tooltip({content: this.sprintCollapsed ? i18n.getMessage('Expand') : i18n.getMessage('Collapse')})}
                  @click=${() => { this.sprintCollapsed = !this.sprintCollapsed; }}
                >
                  <span class=${`transition-transform duration-[var(--duration-sm,150ms)] ${this.sprintCollapsed ? 'rotate-180' : 'rotate-0'}`}>
                    ${icon({name: 'chevron-up', size: 'xs'})}
                  </span>
                </button>
              </div>
            </div>

            ${!this.sprintCollapsed ? this.renderStoryTable(filteredSprint, 'sprint') : nothing}
          </section>

          <!-- Backlog Stories Section -->
          <section
            class="aiux-card flex flex-col transition-all duration-[var(--duration-sm,150ms)] ${this.dropTarget === 'backlog' ? 'dropzone-active' : ''}"
            aria-labelledby="backlog-stories-heading"
            @dragover=${e => this.handleDragOver(e, 'backlog')}
            @dragleave=${e => this.handleDragLeave(e, 'backlog')}
            @drop=${e => this.handleDrop(e, 'backlog')}
          >
            <div class="flex items-center justify-between border-b border-base-300 px-4 py-3 bg-base-200 rounded-t-box">
              <div class="flex items-center gap-2 min-w-0">
                <h2 id="backlog-stories-heading" class="text-base font-semibold text-text-primary truncate">
                  ${i18n.getMessage('Backlog Stories')}
                </h2>
                <span class="aiux-badge aiux-badge-sm aiux-badge-neutral">
                  ${filteredBacklog.length}
                </span>
                <span class="text-xs text-text-secondary tabular-nums">
                  (${backlogPoints} ${i18n.getMessage('pts')})
                </span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  class="aiux-btn aiux-btn-ghost aiux-btn-xs"
                  type="button"
                  aria-label=${i18n.getMessage('Create story in backlog')}
                  ${tooltip({content: i18n.getMessage('Add story to backlog')})}
                  @click=${() => this.openCreateModal('backlog')}
                >
                  ${icon({name: 'plus', size: 'xs'})}
                </button>
                <button
                  class="aiux-btn aiux-btn-ghost aiux-btn-xs aiux-btn-circle"
                  type="button"
                  aria-expanded=${String(!this.backlogCollapsed)}
                  aria-label=${this.backlogCollapsed ? i18n.getMessage('Expand backlog stories') : i18n.getMessage('Collapse backlog stories')}
                  ${tooltip({content: this.backlogCollapsed ? i18n.getMessage('Expand') : i18n.getMessage('Collapse')})}
                  @click=${() => { this.backlogCollapsed = !this.backlogCollapsed; }}
                >
                  <span class=${`transition-transform duration-[var(--duration-sm,150ms)] ${this.backlogCollapsed ? 'rotate-180' : 'rotate-0'}`}>
                    ${icon({name: 'chevron-up', size: 'xs'})}
                  </span>
                </button>
              </div>
            </div>

            ${!this.backlogCollapsed ? this.renderStoryTable(filteredBacklog, 'backlog') : nothing}
          </section>
        </div>

        <!-- Personalize Columns Modal Dialog -->
        ${this.personalizeModalOpen ? html`
          <aiux-modal
            .open=${this.personalizeModalOpen}
            size="md"
            close-on-backdrop
            @aiux-modal:close=${this.closePersonalizeModal}
          >
            <span slot="header" class="text-lg font-semibold text-text-primary">
              ${i18n.getMessage('Personalize List Columns')}
            </span>

            <div class="flex flex-col gap-3 py-2">
              <p class="text-sm text-text-secondary">
                ${i18n.getMessage('Select the columns you want to display in the story tables:')}
              </p>

              <div class="flex flex-col gap-2 rounded-box border border-base-300 p-3 bg-base-200/30">
                ${ALL_COLUMNS.map(col => {
                  const isChecked = this.selectedColumns.includes(col.id);
                  const isRequired = col.required;
                  return html`
                    <label class="flex items-center justify-between p-2 rounded hover:bg-base-200 cursor-pointer ${isRequired ? 'opacity-80' : ''}">
                      <div class="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          class="aiux-checkbox aiux-checkbox-sm"
                          .checked=${isChecked}
                          ?disabled=${isRequired}
                          @change=${() => this.handleToggleColumn(col.id)}
                        />
                        <span class="text-sm text-text-primary font-medium">${getColumnLabel(col.id)}</span>
                      </div>
                      ${isRequired ? html`
                        <span class="text-xs text-text-secondary italic">${i18n.getMessage('Required')}</span>
                      ` : nothing}
                    </label>
                  `;
                })}
              </div>
            </div>

            <div slot="footer" class="flex items-center justify-between w-full gap-2">
              <button
                class="aiux-btn aiux-btn-ghost aiux-btn-sm"
                type="button"
                @click=${this.resetPersonalizedColumns}
              >
                ${i18n.getMessage('Reset to Defaults')}
              </button>
              <div class="flex gap-2">
                <button
                  class="aiux-btn aiux-btn-secondary aiux-btn-sm"
                  type="button"
                  @click=${this.closePersonalizeModal}
                >
                  ${i18n.getMessage('Cancel')}
                </button>
                <button
                  class="aiux-btn aiux-btn-primary aiux-btn-sm"
                  type="button"
                  @click=${this.savePersonalizedColumns}
                >
                  ${i18n.getMessage('Save')}
                </button>
              </div>
            </div>
          </aiux-modal>
        ` : nothing}

        <!-- Create Story Modal Dialog -->
        ${this.createModalOpen ? html`
          <aiux-modal
            .open=${this.createModalOpen}
            size="md"
            close-on-backdrop
            @aiux-modal:close=${this.closeCreateModal}
          >
            <span slot="header" class="text-lg font-semibold text-text-primary">
              ${this.createTarget === 'sprint' ? i18n.getMessage('Create Story in Sprint') : i18n.getMessage('Create Story in Backlog')}
            </span>

            <form id="create-story-form" aria-label=${i18n.getMessage('Create story form')} class="flex flex-col gap-4 py-2" @submit=${this.handleCreateStory}>
              ${this.createError ? html`
                <div class="aiux-alert aiux-alert-error" role="alert">
                  <span>${this.createError}</span>
                </div>
              ` : nothing}

              <!-- Target toggle -->
              <div class="flex flex-col gap-1.5">
                <span class="text-sm font-medium text-text-primary">${i18n.getMessage('Destination')}</span>
                <div class="flex items-center gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="story-target"
                      value="backlog"
                      .checked=${this.createTarget === 'backlog'}
                      @change=${() => { this.createTarget = 'backlog'; }}
                    />
                    <span class="text-sm text-text-primary">${i18n.getMessage('Backlog')}</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="story-target"
                      value="sprint"
                      .checked=${this.createTarget === 'sprint'}
                      @change=${() => { this.createTarget = 'sprint'; }}
                    />
                    <span class="text-sm text-text-primary">${i18n.getMessage('Current Sprint')}</span>
                  </label>
                </div>
              </div>

              <!-- Short Description (Mandatory) -->
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-medium text-text-primary">${i18n.getMessage('Short description')} *</span>
                <input
                  type="text"
                  class="aiux-input w-full"
                  maxlength="160"
                  placeholder=${i18n.getMessage('Brief summary of the story')}
                  .value=${this.newShortDescription}
                  @input=${e => { this.newShortDescription = e.target.value; }}
                  required
                />
              </label>

              <!-- Description (Optional Detailed Notes) -->
              <label class="flex flex-col gap-1.5">
                <span class="text-sm font-medium text-text-primary">${i18n.getMessage('Description')}</span>
                <textarea
                  class="aiux-textarea w-full"
                  rows="3"
                  placeholder=${i18n.getMessage('Detailed acceptance criteria or notes…')}
                  .value=${this.newDescription}
                  @input=${e => { this.newDescription = e.target.value; }}
                ></textarea>
              </label>

              <!-- Points and Priority -->
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium text-text-primary">${i18n.getMessage('Story Points')}</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    class="aiux-input w-full tabular-nums"
                    placeholder="0"
                    aria-label=${i18n.getMessage('Story points')}
                    .value=${this.newStoryPoints}
                    @input=${e => { this.newStoryPoints = e.target.value; }}
                  />
                </label>

                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium text-text-primary">${i18n.getMessage('Priority')}</span>
                  <select
                    class="aiux-select w-full"
                    .value=${this.newPriority}
                    @change=${e => { this.newPriority = e.target.value; }}
                  >
                    <option value="1">${i18n.getMessage('1 - Critical')}</option>
                    <option value="2">${i18n.getMessage('2 - High')}</option>
                    <option value="3">${i18n.getMessage('3 - Moderate')}</option>
                    <option value="4">${i18n.getMessage('4 - Low')}</option>
                  </select>
                </label>
              </div>

              <!-- Assignee and Epic -->
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium text-text-primary">${i18n.getMessage('Assigned To')}</span>
                  <select
                    class="aiux-select w-full"
                    .value=${this.newAssignedTo}
                    @change=${e => { this.newAssignedTo = e.target.value; }}
                  >
                    <option value="">${i18n.getMessage('Unassigned')}</option>
                    ${this.assignees.map(u => html`<option value=${u.id}>${u.name}</option>`)}
                  </select>
                </label>

                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium text-text-primary">${i18n.getMessage('Epic')}</span>
                  <select
                    class="aiux-select w-full"
                    .value=${this.newEpic}
                    @change=${e => { this.newEpic = e.target.value; }}
                  >
                    <option value="">${i18n.getMessage('None')}</option>
                    ${this.epics.map(ep => html`<option value=${ep.id}>${ep.name}</option>`)}
                  </select>
                </label>
              </div>
            </form>

            <div slot="footer" class="flex justify-end gap-2">
              <button
                class="aiux-btn aiux-btn-secondary"
                type="button"
                @click=${this.closeCreateModal}
                ?disabled=${this.creatingStory}
              >
                ${i18n.getMessage('Cancel')}
              </button>
              <button
                class="aiux-btn aiux-btn-primary"
                type="submit"
                form="create-story-form"
                ?disabled=${this.creatingStory}
              >
                ${this.creatingStory ? i18n.getMessage('Creating…') : i18n.getMessage('Create Story')}
              </button>
            </div>
          </aiux-modal>
        ` : nothing}
      </div>
    `;
  }
}
