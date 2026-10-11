import {html, css, nothing} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {AIUXWidgetElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {icon} from '@servicenow/aiux/aiux-directive-icon';
import '@servicenow/aiux/aiux-components-visual-board';

const {name, description, bestFor, discoverable, server} = decorators;

const CARD_CONFIG = {
  tag: 'aiux-vb-card',
  draggable: true,
  sortEnabled: true,
  enableWrapping: true,
  titleLineToTruncate: 2,
  slots: [
    {
      key: 'metadata',
      type: 'fieldGroup',
      config: {
        maxFieldsPerRow: 3,
        fieldDefinitions: [
          {key: 'number', label: 'Story', type: 'string'},
          {key: 'points', label: 'Points', type: 'string'},
          {key: 'priority', label: 'Priority', type: 'string'}
        ]
      }
    },
    {
      key: 'assignee',
      label: 'Assignee',
      type: 'person'
    },
    {
      key: 'due_date',
      label: 'Due Date',
      type: 'string'
    },
    {
      key: 'epic',
      label: 'Epic',
      type: 'string'
    }
  ]
};

const LANE_CONFIG = {
  headerTag: 'aiux-vb-lane-header',
  draggable: false
};

const SWIMLANE_CONFIG = {
  headerTag: 'aiux-vb-swimlane-header',
  draggable: false
};

@customElement('aiux-agile-board')
@name('Agile Board')
@description('Guided Visual Task Board on rm_story with dynamic vertical lanes, swimlanes, and team member chips.')
@bestFor('Conducting daily standup sprint planning using ServiceNow rm_story table.')
@discoverable(true)
@server('./server-script.js')
export default class AgileBoard extends AIUXWidgetElement {
  @property({type: String, attribute: 'sprint-id'}) sprintId = '';
  @property({type: String, attribute: 'group-id'}) groupId = '';

  @state() loading = true;
  @state() error = '';
  @state() groups = [];
  @state() sprints = [];
  @state() selectedGroupId = '';
  @state() selectedSprintId = '';
  @state() groupName = '';
  @state() sprintName = '';
  @state() currentUser = 'System Administrator';
  @state() groupMembersCount = 1;
  @state() stories = [];
  @state() members = [];
  @state() epics = [];
  @state() priorityChoices = [];
  @state() laneChoices = [];

  // Configuration options matching screenshot
  @state() verticalLaneField = 'state';
  @state() swimlaneField = 'none';
  @state() dueDateField = 'due_date';
  @state() excludeChildRecords = true;

  // Selected Team Member Filter Chip
  @state() selectedMemberId = '';

  // Sidebar visibility
  @state() infoSidebarOpen = false;

  // Search & Filter toolbar
  @state() searchKeyword = '';
  @state() dueByFilter = 'all';

  // Add Card quick modal
  @state() addCardModalOpen = false;
  @state() addCardLaneValue = '';
  @state() newCardShortDesc = '';
  @state() newCardPoints = '';
  @state() newCardAssignee = '';

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    aiux-visual-board {
      display: block;
      width: 100%;
      min-height: calc(100vh - 240px);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadBoardData();
  }

  firstUpdated() {
    super.firstUpdated();
    this.addEventListener('aiux-visual-board:card-moved', (e) => this.handleCardMoved(e));
  }

  async loadBoardData() {
    this.loading = true;
    this.error = '';
    try {
      const response = await this.server.get({
        action: 'board_init',
        groupId: this.groupId || this.selectedGroupId,
        sprintId: this.sprintId || this.selectedSprintId,
        verticalLaneField: this.verticalLaneField,
        swimlaneField: this.swimlaneField,
        dueDateField: this.dueDateField
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not load board data.'));
      this.groups = response?.groups || [];
      this.sprints = response?.sprints || [];
      this.selectedGroupId = response?.selectedGroupId || '';
      this.selectedSprintId = response?.selectedSprintId || '';
      this.groupName = response?.groupName || '';
      this.sprintName = response?.sprintName || '';
      this.currentUser = response?.currentUser || 'System Administrator';
      this.groupMembersCount = response?.groupMembersCount || 1;
      this.stories = response?.stories || [];
      this.members = response?.members || [];
      this.epics = response?.epics || [];
      this.priorityChoices = response?.priorityChoices || [];
      this.laneChoices = response?.laneChoices || [];
    } catch (err) {
      this.error = err?.message || i18n.getMessage('Could not load board data.');
    } finally {
      this.loading = false;
    }
  }

  async handleGroupChange(newGroupId) {
    this.selectedGroupId = newGroupId;
    this.selectedSprintId = '';
    this.selectedMemberId = '';
    await this.loadBoardData();
  }

  async handleSprintChange(newSprintId) {
    this.selectedSprintId = newSprintId;
    await this.loadBoardData();
  }

  async handleVerticalLaneFieldChange(newField) {
    this.verticalLaneField = newField;
    await this.loadBoardData();
  }

  async handleDueDateFieldChange(newField) {
    this.dueDateField = newField;
    await this.loadBoardData();
  }

  handleSwimlaneFieldChange(newField) {
    this.swimlaneField = newField;
  }

  handleMemberChipClick(memberId) {
    if (this.selectedMemberId === memberId) {
      this.selectedMemberId = '';
    } else {
      this.selectedMemberId = memberId;
    }
  }

  async handleCardMoved(event) {
    const {id, toLane, toPosition, toSwimlane} = event.detail || {};
    if (!id || !toLane) return;

    this.error = '';

    // 1. Optimistic UI update: instantly update the story in local memory
    const storyIdx = this.stories.findIndex(s => s.sys_id === id);
    if (storyIdx !== -1) {
      const updatedList = [...this.stories];
      const story = {...updatedList[storyIdx]};

      if (this.verticalLaneField === 'state') {
        story.state = toLane;
      } else if (this.verticalLaneField === 'priority') {
        story.priority = toLane;
      }

      if (this.swimlaneField === 'assigned_to' && toSwimlane !== undefined) {
        story.assigned_to = toSwimlane === 'unassigned' ? '' : toSwimlane;
        const assignedMember = this.members.find(m => m.id === toSwimlane);
        story.assigned_to_name = assignedMember ? assignedMember.name : (toSwimlane === 'unassigned' ? '' : story.assigned_to_name);
      } else if (this.swimlaneField === 'epic' && toSwimlane !== undefined) {
        story.epic = toSwimlane === 'no_epic' ? '' : toSwimlane;
      } else if (this.swimlaneField === 'priority' && toSwimlane !== undefined) {
        story.priority = toSwimlane;
      }

      updatedList[storyIdx] = story;
      this.stories = updatedList;
    }

    // 2. Persist to ServiceNow rm_story
    try {
      const response = await this.server.get({
        action: 'update_story_lane',
        groupId: this.selectedGroupId,
        sprintId: this.selectedSprintId,
        storyId: id,
        field: this.verticalLaneField,
        value: toLane,
        swimlaneField: this.swimlaneField,
        toSwimlane,
        newRank: toPosition !== undefined ? String(toPosition) : '',
        dueDateField: this.dueDateField
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not update story status.'));
      if (response?.stories) {
        this.stories = response.stories;
      }
    } catch (err) {
      this.error = err?.message || i18n.getMessage('Could not update story status.');
    }
  }

  openAddCard(laneValue) {
    this.addCardLaneValue = laneValue || (this.laneChoices.length ? this.laneChoices[0].value : '');
    this.newCardShortDesc = '';
    this.newCardPoints = '';
    this.newCardAssignee = this.selectedMemberId || '';
    this.addCardModalOpen = true;
  }

  closeAddCard() {
    this.addCardModalOpen = false;
  }

  async handleCreateCard(event) {
    event.preventDefault();
    const shortDesc = this.newCardShortDesc.trim();
    if (!shortDesc) return;

    this.error = '';
    try {
      const response = await this.server.get({
        action: 'create_card',
        groupId: this.selectedGroupId,
        sprintId: this.selectedSprintId,
        laneField: this.verticalLaneField,
        laneValue: this.addCardLaneValue,
        short_description: shortDesc,
        story_points: this.newCardPoints,
        assigned_to: this.newCardAssignee,
        dueDateField: this.dueDateField
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not create story card.'));
      this.stories = response?.stories || this.stories;
      this.closeAddCard();
    } catch (err) {
      this.error = err?.message || i18n.getMessage('Could not create story card.');
    }
  }

  getFilteredStories() {
    const kw = this.searchKeyword.toLowerCase().trim();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return this.stories.filter(story => {
      // 1. Team member chip filter
      if (this.selectedMemberId && story.assigned_to !== this.selectedMemberId) {
        return false;
      }

      // 2. Keyword filter
      if (kw) {
        const matchesNum = (story.number || '').toLowerCase().includes(kw);
        const matchesDesc = (story.short_description || '').toLowerCase().includes(kw);
        if (!matchesNum && !matchesDesc) return false;
      }

      // 3. Due by filter
      if (this.dueByFilter !== 'all') {
        const d = story.due_date;
        if (this.dueByFilter === 'no_due_date') {
          if (d) return false;
        } else if (!d) {
          return false;
        } else {
          const dateOnly = d.split(' ')[0];
          if (this.dueByFilter === 'overdue' && dateOnly >= todayStr) return false;
          if (this.dueByFilter === 'today' && dateOnly !== todayStr) return false;
        }
      }

      return true;
    });
  }

  getLanes() {
    return this.laneChoices.map(c => ({
      id: c.value,
      title: c.label || c.value
    }));
  }

  getSwimlanes() {
    if (this.swimlaneField === 'assigned_to') {
      const swimlanes = [
        {
          id: 'unassigned',
          title: i18n.getMessage('No Assigned to')
        }
      ];

      this.members.forEach(member => {
        swimlanes.push({
          id: member.id,
          title: member.name,
          avatarInitials: member.initials
        });
      });

      return swimlanes;
    }

    if (this.swimlaneField === 'epic') {
      const swimlanes = [
        {
          id: 'no_epic',
          title: i18n.getMessage('No Epic')
        }
      ];

      this.epics.forEach(epic => {
        swimlanes.push({
          id: epic.id,
          title: epic.name
        });
      });

      return swimlanes;
    }

    if (this.swimlaneField === 'priority') {
      return this.priorityChoices.map(p => ({
        id: p.value,
        title: p.label || p.value
      }));
    }

    return [];
  }

  getCards(filteredStories) {
    return filteredStories.map((story, index) => {
      let laneId = story.state;
      if (this.verticalLaneField === 'priority') {
        laneId = story.priority;
      }

      let swimlaneId;
      if (this.swimlaneField === 'assigned_to') {
        swimlaneId = story.assigned_to || 'unassigned';
      } else if (this.swimlaneField === 'epic') {
        swimlaneId = story.epic || 'no_epic';
      } else if (this.swimlaneField === 'priority') {
        swimlaneId = story.priority || '3';
      }

      const labels = [];
      if (story.blocked) {
        labels.push({
          text: `BLOCKER: ${story.blocked_reason || i18n.getMessage('Blocked')}`,
          tone: 'error'
        });
      }

      return {
        id: story.sys_id,
        title: story.short_description,
        order: index,
        laneId: laneId || (this.laneChoices.length ? this.laneChoices[0].value : ''),
        ...(swimlaneId ? {swimlaneId} : {}),
        labels,
        slotsData: {
          metadata: {
            fields: {
              number: {value: story.number, displayValue: story.number},
              points: {value: story.story_points, displayValue: `${story.story_points || '0'} pts`},
              priority: {value: story.priority_label, displayValue: story.priority_label || ''}
            }
          },
          assignee: {
            value: story.assigned_to,
            displayValue: story.assigned_to_name || i18n.getMessage('Unassigned'),
            avatar: ''
          },
          due_date: {
            value: story.due_date,
            displayValue: story.due_date || '—'
          },
          epic: {
            value: story.epic,
            displayValue: story.epic_name || '—'
          }
        }
      };
    });
  }

  render() {
    const filteredStories = this.getFilteredStories();
    const lanes = this.getLanes();
    const swimlanes = this.getSwimlanes();
    const cards = this.getCards(filteredStories);
    const uniqueAssignees = new Set(this.stories.map(s => s.assigned_to).filter(Boolean)).size;

    return html`
      <div class="flex h-full w-full bg-base-100 text-text-primary overflow-hidden">
        <!-- Main Board Canvas -->
        <div class="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
          <!-- Top Header Bar -->
          <div class="flex flex-col gap-2.5 px-4 py-3 bg-base-100 border-b border-base-300">
            <!-- Row 1: Agile Team Picker, Sprint Picker, Search, and Tools -->
            <div class="flex flex-wrap items-center justify-between gap-3">
              <!-- Left: Agile Team & Sprint Selectors -->
              <div class="flex flex-wrap items-center gap-2.5">
                <!-- Agile Team Selector -->
                <label class="flex items-center gap-1.5">
                  <span class="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    ${i18n.getMessage('Team:')}
                  </span>
                  <select
                    class="aiux-select aiux-select-sm font-semibold max-w-56"
                    aria-label=${i18n.getMessage('Select Agile Team')}
                    .value=${this.selectedGroupId}
                    @change=${e => this.handleGroupChange(e.target.value)}
                  >
                    ${this.groups.map(g => html`
                      <option value=${g.sys_id}>${g.name}</option>
                    `)}
                  </select>
                </label>

                <!-- Sprint Selector -->
                <label class="flex items-center gap-1.5">
                  <span class="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    ${i18n.getMessage('Sprint:')}
                  </span>
                  <select
                    class="aiux-select aiux-select-sm font-semibold max-w-64"
                    aria-label=${i18n.getMessage('Select Sprint')}
                    .value=${this.selectedSprintId}
                    @change=${e => this.handleSprintChange(e.target.value)}
                  >
                    ${this.sprints.map(s => html`
                      <option value=${s.sys_id}>
                        ${s.name} ${s.state === '2' ? `(${i18n.getMessage('Current')})` : ''}
                      </option>
                    `)}
                  </select>
                </label>
              </div>

              <!-- Right: Search, Due By, Add Card, and Info Toggle -->
              <div class="flex items-center gap-2 shrink-0">
                <!-- Filter by title or number -->
                <div class="relative w-52 sm:w-60">
                  <span class="absolute inset-y-0 start-2.5 flex items-center text-text-secondary pointer-events-none">
                    ${icon({name: 'filter', size: 'xs'})}
                  </span>
                  <input
                    type="search"
                    class="aiux-input aiux-input-sm w-full ps-8 bg-base-200/50"
                    placeholder=${i18n.getMessage('Filter by title or number')}
                    aria-label=${i18n.getMessage('Filter by title or number')}
                    .value=${this.searchKeyword}
                    @input=${e => { this.searchKeyword = e.target.value; }}
                  />
                </div>

                <!-- Due By dropdown -->
                <label class="flex items-center gap-1">
                  <span class="sr-only">${i18n.getMessage('Due By')}</span>
                  <select
                    class="aiux-select aiux-select-sm bg-base-200/50"
                    aria-label=${i18n.getMessage('Filter by Due Date')}
                    .value=${this.dueByFilter}
                    @change=${e => { this.dueByFilter = e.target.value; }}
                  >
                    <option value="all">${i18n.getMessage('Due By')}</option>
                    <option value="overdue">${i18n.getMessage('Overdue')}</option>
                    <option value="today">${i18n.getMessage('Due Today')}</option>
                    <option value="no_due_date">${i18n.getMessage('No Due Date')}</option>
                  </select>
                </label>

                <!-- Quick Add Story Button -->
                <button
                  class="aiux-btn aiux-btn-primary aiux-btn-sm"
                  type="button"
                  @click=${() => this.openAddCard('')}
                  title=${i18n.getMessage('Add Story Card')}
                >
                  ${icon({name: 'plus', size: 'xs'})}
                  <span>${i18n.getMessage('Add Card')}</span>
                </button>

                <div class="h-5 w-px bg-base-300"></div>

                <!-- (i) Info / Configuration Toggle -->
                <button
                  class="aiux-btn aiux-btn-ghost aiux-btn-sm aiux-btn-circle ${this.infoSidebarOpen ? 'bg-base-200 text-primary' : 'text-text-secondary'}"
                  type="button"
                  aria-label=${i18n.getMessage('Toggle Board Info and Configuration')}
                  title=${i18n.getMessage('Board Info & Structure')}
                  @click=${() => { this.infoSidebarOpen = !this.infoSidebarOpen; }}
                >
                  ${icon({name: 'circle-info', size: 'sm'})}
                </button>
              </div>
            </div>

            <!-- Row 2: Team Members interactive chips matching screenshot -->
            <div class="flex items-center gap-2 pt-1 border-t border-base-200 overflow-x-auto">
              <span class="text-xs font-semibold text-text-secondary shrink-0">
                ${i18n.getMessage('Team members:')}
              </span>

              <div class="flex items-center gap-1.5 flex-wrap">
                ${this.members.map(m => {
                  const isSelected = this.selectedMemberId === m.id;
                  return html`
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${isSelected
                        ? 'bg-primary text-primary-content shadow ring-2 ring-primary ring-offset-1'
                        : 'bg-base-200 hover:bg-base-300 text-text-primary border border-base-300'}"
                      aria-pressed=${isSelected ? 'true' : 'false'}
                      aria-label=${i18n.getMessage('Filter stories by {0}', [m.name])}
                      @click=${() => this.handleMemberChipClick(m.id)}
                    >
                      <span class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isSelected
                        ? 'bg-primary-content text-primary'
                        : 'bg-primary/20 text-primary'}">
                        ${m.initials}
                      </span>
                      <span>${m.name}</span>
                    </button>
                  `;
                })}

                ${this.selectedMemberId ? html`
                  <button
                    type="button"
                    class="aiux-btn aiux-btn-ghost aiux-btn-xs ms-1 text-xs text-text-secondary"
                    @click=${() => { this.selectedMemberId = ''; }}
                  >
                    ${i18n.getMessage('Clear filter')}
                  </button>
                ` : nothing}
              </div>
            </div>
          </div>

          <!-- Alert error banner -->
          ${this.error ? html`
            <div class="aiux-alert aiux-alert-error m-3" role="alert">
              <span>${this.error}</span>
            </div>
          ` : nothing}

          <!-- Visual Board Area -->
          <div class="flex-1 p-3 overflow-x-auto min-w-0">
            ${this.loading ? html`
              <div class="flex gap-4 p-4">
                ${[1, 2, 3, 4, 5, 6, 7].map(() => html`
                  <div class="w-72 h-[500px] rounded-box bg-base-200/50 border border-base-300 p-3 space-y-3">
                    <div class="aiux-skeleton h-10 w-full rounded"></div>
                    <div class="aiux-skeleton h-24 w-full rounded-box"></div>
                    <div class="aiux-skeleton h-24 w-full rounded-box"></div>
                  </div>
                `)}
              </div>
            ` : html`
              <aiux-visual-board
                .lanes=${lanes}
                .cards=${cards}
                .swimlanes=${swimlanes}
                .cardConfig=${CARD_CONFIG}
                .laneConfig=${LANE_CONFIG}
                .swimlaneConfig=${SWIMLANE_CONFIG}
                @aiux-visual-board:card-moved=${this.handleCardMoved}
              ></aiux-visual-board>
            `}
          </div>
        </div>

        <!-- Right Side Panel: "Info" matching Screenshot exactly -->
        ${this.infoSidebarOpen ? html`
          <aside
            class="w-80 min-w-80 border-l border-base-300 bg-base-100 flex flex-col h-full shadow-lg z-20"
            aria-label=${i18n.getMessage('Board Info and Configuration Panel')}
          >
            <!-- Panel Header -->
            <div class="flex items-center justify-between p-4 border-b border-base-300">
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-text-primary">
                  ${i18n.getMessage('Info')}
                </h2>
                <button
                  class="aiux-btn aiux-btn-ghost aiux-btn-xs aiux-btn-circle text-text-secondary"
                  type="button"
                  aria-label=${i18n.getMessage('Favorite Board')}
                >
                  ${icon({name: 'star', size: 'xs'})}
                </button>
              </div>

              <button
                class="aiux-btn aiux-btn-ghost aiux-btn-xs aiux-btn-circle text-text-secondary"
                type="button"
                aria-label=${i18n.getMessage('Close Info Panel')}
                @click=${() => { this.infoSidebarOpen = false; }}
              >
                ${icon({name: 'close', size: 'xs'})}
              </button>
            </div>

            <!-- Panel Content -->
            <div class="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
              <!-- SECTION: THE BASICS -->
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                  ${i18n.getMessage('THE BASICS')}
                </h3>
                <dl class="space-y-2 text-xs">
                  <div class="flex justify-between py-1 border-b border-base-200">
                    <dt class="text-text-secondary">${i18n.getMessage('Name')}</dt>
                    <dd class="font-medium text-text-primary truncate max-w-44 text-right">
                      ${this.groupName}: ${this.sprintName}
                    </dd>
                  </div>
                  <div class="flex justify-between py-1 border-b border-base-200">
                    <dt class="text-text-secondary">${i18n.getMessage('Board Type')}</dt>
                    <dd class="font-medium text-text-primary">${i18n.getMessage('Guided')}</dd>
                  </div>
                  <div class="flex justify-between py-1 border-b border-base-200">
                    <dt class="text-text-secondary">${i18n.getMessage('Owned by')}</dt>
                    <dd class="font-medium text-text-primary">${this.currentUser}</dd>
                  </div>
                  <div class="flex justify-between py-1 border-b border-base-200">
                    <dt class="text-text-secondary">${i18n.getMessage('Members')}</dt>
                    <dd class="font-medium text-text-primary">${this.groupMembersCount}</dd>
                  </div>
                  <div class="flex justify-between py-1 border-b border-base-200">
                    <dt class="text-text-secondary">${i18n.getMessage('Assignees')}</dt>
                    <dd class="font-medium text-text-primary">${uniqueAssignees}</dd>
                  </div>
                  <div class="flex justify-between py-1 border-b border-base-200">
                    <dt class="text-text-secondary">${i18n.getMessage('Vertical Lanes')}</dt>
                    <dd class="font-medium text-text-primary">${lanes.length}</dd>
                  </div>
                  <div class="flex justify-between py-1 border-b border-base-200">
                    <dt class="text-text-secondary">${i18n.getMessage('Swimlanes')}</dt>
                    <dd class="font-medium text-text-primary">${swimlanes.length}</dd>
                  </div>
                  <div class="flex justify-between py-1 border-b border-base-200">
                    <dt class="text-text-secondary">${i18n.getMessage('Tasks')}</dt>
                    <dd class="font-medium text-text-primary">${this.stories.length}</dd>
                  </div>
                </dl>
              </div>

              <!-- SECTION: STRUCTURE -->
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                  ${i18n.getMessage('STRUCTURE')}
                </h3>
                <div class="space-y-3.5 text-xs">
                  <div>
                    <span class="text-text-secondary block mb-1">${i18n.getMessage('Table')}</span>
                    <span class="font-mono text-xs px-2 py-1 bg-base-200 rounded block text-text-primary">
                      rm_story
                    </span>
                  </div>

                  <div>
                    <span class="text-text-secondary block mb-1">${i18n.getMessage('Board Filter')}</span>
                    <span class="text-xs text-text-primary block bg-base-200/50 p-2 rounded break-words">
                      Sprint.State = Current, Assignment group = ${this.groupName}
                    </span>
                  </div>

                  <!-- Exclude Child Table Records -->
                  <label class="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      class="aiux-checkbox aiux-checkbox-xs"
                      .checked=${this.excludeChildRecords}
                      @change=${e => { this.excludeChildRecords = e.target.checked; }}
                    />
                    <span class="text-text-primary font-medium">
                      ${i18n.getMessage('Exclude Child Table Records')}
                    </span>
                  </label>

                  <!-- Vertical Lane Field (Configurable!) -->
                  <label class="flex flex-col gap-1.5 pt-2">
                    <span class="font-semibold text-text-primary">
                      ${i18n.getMessage('Vertical Lane Field')}
                    </span>
                    <select
                      class="aiux-select aiux-select-sm w-full font-medium"
                      aria-label=${i18n.getMessage('Vertical Lane Field')}
                      .value=${this.verticalLaneField}
                      @change=${e => this.handleVerticalLaneFieldChange(e.target.value)}
                    >
                      <option value="state">${i18n.getMessage('State')}</option>
                      <option value="priority">${i18n.getMessage('Priority')}</option>
                    </select>
                  </label>

                  <!-- Swimlane Field (Configurable!) -->
                  <label class="flex flex-col gap-1.5 pt-2">
                    <span class="font-semibold text-text-primary">
                      ${i18n.getMessage('Swimlane Field')}
                    </span>
                    <select
                      class="aiux-select aiux-select-sm w-full font-medium"
                      aria-label=${i18n.getMessage('Swimlane Field')}
                      .value=${this.swimlaneField}
                      @change=${e => this.handleSwimlaneFieldChange(e.target.value)}
                    >
                      <option value="none">${i18n.getMessage('--No Swimlanes--')}</option>
                      <option value="assigned_to">${i18n.getMessage('Assigned to')}</option>
                      <option value="epic">${i18n.getMessage('Epic')}</option>
                      <option value="priority">${i18n.getMessage('Priority')}</option>
                    </select>
                  </label>

                  <!-- Due Date Field (Configurable!) -->
                  <label class="flex flex-col gap-1.5 pt-2">
                    <span class="font-semibold text-text-primary">
                      ${i18n.getMessage('Due Date Field')}
                    </span>
                    <select
                      class="aiux-select aiux-select-sm w-full font-medium"
                      aria-label=${i18n.getMessage('Due Date Field')}
                      .value=${this.dueDateField}
                      @change=${e => this.handleDueDateFieldChange(e.target.value)}
                    >
                      <option value="due_date">${i18n.getMessage('Due date')}</option>
                      <option value="end_date">${i18n.getMessage('End date')}</option>
                      <option value="sys_created_on">${i18n.getMessage('Created')}</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </aside>
        ` : nothing}

        <!-- Add Card Modal Form -->
        ${this.addCardModalOpen ? html`
          <aiux-modal
            .open=${this.addCardModalOpen}
            size="md"
            close-on-backdrop
            @aiux-modal:close=${this.closeAddCard}
          >
            <span slot="header" class="text-base font-bold text-text-primary">
              ${i18n.getMessage('Add Story Card to rm_story')}
            </span>

            <form class="py-2 space-y-3.5" @submit=${this.handleCreateCard}>
              <label class="flex flex-col gap-1">
                <span class="text-xs font-semibold text-text-primary">${i18n.getMessage('Short description *')}</span>
                <input
                  type="text"
                  class="aiux-input aiux-input-sm w-full"
                  required
                  placeholder=${i18n.getMessage('Story title…')}
                  aria-label=${i18n.getMessage('Short description')}
                  .value=${this.newCardShortDesc}
                  @input=${e => { this.newCardShortDesc = e.target.value; }}
                />
              </label>

              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-semibold text-text-primary">${i18n.getMessage('Lane')}</span>
                  <select
                    class="aiux-select aiux-select-sm w-full"
                    aria-label=${i18n.getMessage('Lane')}
                    .value=${this.addCardLaneValue}
                    @change=${e => { this.addCardLaneValue = e.target.value; }}
                  >
                    ${this.laneChoices.map(c => html`
                      <option value=${c.value}>${c.label || c.value}</option>
                    `)}
                  </select>
                </label>

                <label class="flex flex-col gap-1">
                  <span class="text-xs font-semibold text-text-primary">${i18n.getMessage('Story points')}</span>
                  <input
                    type="number"
                    min="0"
                    class="aiux-input aiux-input-sm w-full"
                    placeholder="0"
                    aria-label=${i18n.getMessage('Story points')}
                    .value=${this.newCardPoints}
                    @input=${e => { this.newCardPoints = e.target.value; }}
                  />
                </label>
              </div>

              ${this.members.length ? html`
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-semibold text-text-primary">${i18n.getMessage('Assignee')}</span>
                  <select
                    class="aiux-select aiux-select-sm w-full"
                    aria-label=${i18n.getMessage('Assignee')}
                    .value=${this.newCardAssignee}
                    @change=${e => { this.newCardAssignee = e.target.value; }}
                  >
                    <option value="">${i18n.getMessage('Unassigned')}</option>
                    ${this.members.map(u => html`<option value=${u.id}>${u.name}</option>`)}
                  </select>
                </label>
              ` : nothing}

              <div class="flex justify-end gap-2 pt-2 border-t border-base-200">
                <button
                  class="aiux-btn aiux-btn-secondary aiux-btn-sm"
                  type="button"
                  @click=${this.closeAddCard}
                >
                  ${i18n.getMessage('Cancel')}
                </button>
                <button
                  class="aiux-btn aiux-btn-primary aiux-btn-sm"
                  type="submit"
                >
                  ${i18n.getMessage('Create Card')}
                </button>
              </div>
            </form>
          </aiux-modal>
        ` : nothing}
      </div>
    `;
  }
}
