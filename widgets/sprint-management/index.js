import {html, css} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {
  AIUXWidgetElement,
  decorators
} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {icon} from '@servicenow/aiux/aiux-directive-icon';
import {tooltip} from '@servicenow/aiux/aiux-directive-tooltip';
import '@servicenow/aiux/aiux-components-pagination';

const {name, description, bestFor, discoverable, server} = decorators;

@customElement('aiux-sprint-management')
@name('Sprint Management')
@description('Lists and manages ServiceNow sprints for Agile Team groups the current user belongs to.')
@bestFor('Sprint governance dashboards with membership-scoped sprint management.')
@discoverable(false)
@server('./server-script.js')
export default class SprintManagement extends AIUXWidgetElement {
  @state() groups = [];
  @state() sprints = [];
  @state() selectedGroup = '';
  @state() searchTerm = '';
  @state() statusFilter = '';
  @state() page = 1;
  @state() pageSize = 5;
  @state() sortField = 'name';
  @state() sortDirection = 'desc';
  @state() name = '';
  @state() startingNumber = '';
  @state() startDate = '';
  @state() duration = 14;
  @state() sprintCount = 1;
  @state() createOpen = false;
  @state() defaultsLoading = false;
  @state() loading = true;
  @state() creating = false;
  @state() actionId = '';
  @state() editingCapacityId = '';
  @state() error = '';
  @state() notice = '';
  @state() hasMore = false;

  static styles = css`
    :host { display: block; }

    @media (forced-colors: active) {
      button,
      input,
      select,
      textarea {
        forced-color-adjust: none;
        color: ButtonText;
        background: ButtonFace;
        border: 1px solid ButtonBorder;
      }

      button:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 2px solid Highlight;
        outline-offset: 2px;
      }

      button:disabled {
        color: GrayText;
        border-color: GrayText;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  async load() {
    if (this.loadingRequest) return;
    this.loadingRequest = true;
    this.loading = true;
    this.error = '';
    try {
      const response = await this.server.get({action: 'list'});
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not load sprints.'));
      this.setGroups(response?.groups || []);
      this.sprints = response?.sprints || [];
      this.hasMore = Boolean(response?.hasMore);
      this.page = 1;
    } catch (error) {
      this.error = error?.message || i18n.getMessage('Could not load sprints.');
    } finally {
      this.loading = false;
      this.loadingRequest = false;
    }
  }

  setGroups(groups) {
    this.groups = [...groups].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, {sensitivity: 'base'}));
    if (!this.groups.some(group => group.sys_id === this.selectedGroup)) {
      this.selectedGroup = this.groups[0]?.sys_id || '';
    }
  }

  async create(event) {
    event.preventDefault();
    if (this.creating || !this.selectedGroup) return;
    const count = Number(this.sprintCount);
    const days = Number(this.duration);
    if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(days) || days < 1 || days > 365 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(this.toDateTimeInputValue(this.startDate))) {
      this.error = i18n.getMessage('Enter 1 to 100 sprints and a duration from 1 to 365 days.');
      return;
    }
    if (!this.name.trim() || (count > 1 && !/^\d+$/.test(String(this.startingNumber)))) {
      this.error = i18n.getMessage('Enter a sprint name and a starting number when creating multiple sprints.');
      return;
    }
    const rows = [];
    const baseNumber = /^\d+$/.test(String(this.startingNumber)) ? Number(this.startingNumber) : null;
    for (let index = 0; index < count; index++) {
      const firstStart = this.addLocalDays(this.startDate, index * days);
      const lastEnd = this.addLocalDays(this.startDate, (index + 1) * days, -1);
      const suffix = baseNumber === null ? '' : ` ${baseNumber + index}`;
      rows.push({name: `${this.name.trim()}${suffix}`, start_date: this.toServerDateTime(firstStart), end_date: this.toServerDateTime(lastEnd)});
    }
    this.creating = true;
    this.error = '';
    this.notice = '';
    this.createdCountFromError = 0;
    try {
      const response = await this.server.get({
        action: 'create',
        sprints: rows.map(row => ({...row, assignment_group: this.selectedGroup}))
      });
      if (response.groups) this.setGroups(response.groups);
      this.sprints = response.sprints || this.sprints;
      this.hasMore = Boolean(response.hasMore);
      this.createdCountFromError = Number(response.createdCount || 0);
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not create sprints.'));
      this.notice = i18n.getMessage('{0} sprint(s) created as Draft.', [response.createdCount ?? rows.length]);
      this.createdCountFromError = 0;
      this.closeCreateDialog();
    } catch (error) {
      this.error = error?.message || i18n.getMessage('Could not create sprints.');
      if (this.createdCountFromError) this.notice = i18n.getMessage('{0} sprint(s) were created before the request failed.', [this.createdCountFromError]);
    } finally {
      this.creating = false;
    }
  }

  toDateTimeInputValue(value) {
    const normalized = String(value || '').replace(' ', 'T').slice(0, 19);
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized) ? `${normalized}:00` : normalized;
  }

  toServerDateTime(value) {
    return this.toDateTimeInputValue(value).replace('T', ' ');
  }

  addLocalDays(value, days, seconds = 0) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(this.toDateTimeInputValue(value));
    if (!match) return '';
    const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days, Number(match[4]), Number(match[5]), Number(match[6]) + seconds);
    return new Date(timestamp).toISOString().slice(0, 19);
  }

  schedulePreview() {
    const count = Number(this.sprintCount);
    const duration = Number(this.duration);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(this.toDateTimeInputValue(this.startDate)) || !Number.isInteger(count) || count < 1 || count > 100 ||
      !Number.isInteger(duration) || duration < 1 || duration > 365) return [];
    const baseNumber = /^\d+$/.test(String(this.startingNumber)) ? Number(this.startingNumber) : null;
    const preview = [];
    for (let index = 0; index < count; index++) {
      const start = this.addLocalDays(this.startDate, index * duration);
      const end = this.addLocalDays(this.startDate, (index + 1) * duration, -1);
      const suffix = baseNumber === null ? '' : ` ${baseNumber + index}`;
      preview.push({
        name: `${this.name.trim()}${suffix}`,
        start: this.toServerDateTime(start),
        end: this.toServerDateTime(end)
      });
    }
    return preview;
  }

  async openCreateDialog() {
    if (!this.selectedGroup || this.defaultsLoading) return;
    this.createOpen = true;
    this.error = '';
    this.duration = 14;
    this.sprintCount = 1;
    await this.updateComplete;
    await this.loadDefaults();
  }

  closeCreateDialog() {
    this.createOpen = false;
  }

  async loadDefaults() {
    if (!this.selectedGroup) return;
    this.defaultsLoading = true;
    this.error = '';
    try {
      const response = await this.server.get({action: 'defaults', groupId: this.selectedGroup});
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not load sprint defaults.'));
      this.name = response?.defaults?.name || '';
      this.startingNumber = response?.defaults?.number || '';
      this.startDate = response?.defaults?.start_date || '';
      this.sprints = response?.sprints || this.sprints;
    } catch (error) {
      this.error = error?.message || i18n.getMessage('Could not load sprint defaults.');
    } finally {
      this.defaultsLoading = false;
    }
  }

  async changeState(event) {
    const button = event.currentTarget;
    const sysId = button.dataset.id;
    const action = button.dataset.action;
    if (!sysId || this.actionId) return;
    this.actionId = sysId;
    this.error = '';
    this.notice = '';
    try {
      const response = await this.server.get({action, sysId});
      if (response.groups) this.setGroups(response.groups);
      this.sprints = response.sprints || this.sprints;
      this.hasMore = Boolean(response.hasMore);
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not update the sprint.'));
      this.notice = action === 'start'
        ? i18n.getMessage('Sprint started.')
        : i18n.getMessage('Sprint completed.');
    } catch (error) {
      this.error = error?.message || i18n.getMessage('Could not update the sprint.');
    } finally {
      this.actionId = '';
    }
  }

  async updateCapacity(event) {
    const button = event.currentTarget;
    const sysId = button.dataset.id;
    const input = button.closest('td')?.querySelector('input');
    const teamPoints = input?.value;
    if (!sysId || !input || this.actionId) return;
    if (teamPoints.trim() === '' || !Number.isFinite(Number(teamPoints)) || Number(teamPoints) < 0) {
      this.error = i18n.getMessage('Enter a valid non-negative group capacity.');
      return;
    }

    this.actionId = sysId;
    this.error = '';
    this.notice = '';
    try {
      const response = await this.server.get({action: 'update_capacity', sysId, teamPoints});
      this.sprints = response.sprints || this.sprints;
      this.hasMore = Boolean(response.hasMore);
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Group capacity points could not be updated.'));
      this.notice = i18n.getMessage('Group capacity points updated.');
      this.editingCapacityId = '';
    } catch (error) {
      this.error = error?.message || i18n.getMessage('Group capacity points could not be updated.');
    } finally {
      this.actionId = '';
    }
  }

  async beginCapacityEdit(sysId) {
    if (this.actionId) return;
    this.editingCapacityId = sysId;
    await this.updateComplete;
    this.renderRoot.querySelector(`input[data-capacity-input="${sysId}"]`)?.focus();
  }

  cancelCapacityEdit() {
    this.editingCapacityId = '';
  }

  formatDate(value) {
    const iso = (value || '').slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return value || i18n.getMessage('Not set');
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    let locale = globalThis.window?.NOW?.locale || 'en-US';
    const localeMap = {pb: 'pt-BR', zt: 'zh-TW', fq: 'fr-CA'};
    locale = localeMap[locale] || locale;
    try {
      return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'UTC'}).format(date);
    } catch {
      return iso;
    }
  }

  statusClass(state) {
    if (state === '2') return 'aiux-badge-success';
    if (state === '3') return 'aiux-badge-neutral';
    if (state === '4') return 'aiux-badge-error';
    if (state === '1') return 'aiux-badge-info';
    return 'aiux-badge-warning';
  }

  filteredAndSortedSprints() {
    const query = this.searchTerm.trim().toLocaleLowerCase();
    const rows = this.sprints.filter(sprint =>
      (!this.selectedGroup || sprint.assignment_group === this.selectedGroup) &&
      (!this.statusFilter || sprint.state === this.statusFilter) &&
      (!query || sprint.name.toLocaleLowerCase().includes(query))
    );
    rows.sort((left, right) => {
      const currentSprintPriority = Number(right.state === '2') - Number(left.state === '2');
      if (currentSprintPriority) return currentSprintPriority;

      let first = left[this.sortField] ?? '';
      let second = right[this.sortField] ?? '';
      if (this.sortField === 'team_points' || this.sortField === 'committed_points' ||
        this.sortField === 'story_points' || this.sortField === 'actual_points') {
        first = Number(first) || 0;
        second = Number(second) || 0;
        return (first - second) * (this.sortDirection === 'asc' ? 1 : -1);
      }
      const comparison = String(first).localeCompare(String(second), undefined, {numeric: true, sensitivity: 'base'});
      return comparison * (this.sortDirection === 'asc' ? 1 : -1);
    });
    return rows;
  }

  changeSort(field) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'start_date' || field === 'end_date' ? 'desc' : 'asc';
    }
    this.page = 1;
  }

  sortHeader(field, label) {
    const active = this.sortField === field;
    const direction = active ? this.sortDirection : '';
    const glyph = active ? (direction === 'asc' ? '↑' : '↓') : '↕';
    return html`<th scope="col" aria-sort=${active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" class="aiux-btn aiux-btn-ghost aiux-btn-md h-auto min-h-0 w-full justify-start whitespace-normal px-2 py-2 text-left text-base font-semibold leading-normal" @click=${() => this.changeSort(field)}><span class="min-w-0 whitespace-normal">${label}</span><span class="shrink-0" aria-hidden="true">${glyph}</span></button></th>`;
  }

  render() {
    const filteredSprints = this.filteredAndSortedSprints();
    const totalPages = Math.max(1, Math.ceil(filteredSprints.length / this.pageSize));
    const currentPage = Math.min(this.page, totalPages);
    const startIndex = filteredSprints.length ? (currentPage - 1) * this.pageSize : 0;
    const visibleSprints = filteredSprints.slice(startIndex, startIndex + this.pageSize);
    const rangeEnd = Math.min(startIndex + this.pageSize, filteredSprints.length);
    const schedulePreview = this.schedulePreview();
    return html`
      <main class="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8" aria-labelledby="sprint-page-title">
        <header class="flex flex-col justify-between gap-4 border-b border-base-300 pb-6 sm:flex-row sm:items-end">
          <div>
            <p class="text-sm font-semibold uppercase tracking-wide text-primary">${i18n.getMessage('Sprint governance')}</p>
            <h1 id="sprint-page-title" class="mt-1 text-3xl font-bold text-base-content">${i18n.getMessage('Sprint Planning')}</h1>
            <p class="mt-2 max-w-2xl text-sm text-base-content/70">${i18n.getMessage('Manage sprints for Agile Team groups you belong to.')}</p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label class="flex flex-col gap-1"><span class="text-sm font-medium">${i18n.getMessage('Agile Team group')}</span><select class="aiux-select aiux-select-bordered aiux-select-md" .value=${this.selectedGroup} @change=${event => { this.selectedGroup = event.currentTarget.value; this.page = 1; }} ?disabled=${this.loading || !this.groups.length}>${this.groups.map(group => html`<option value=${group.sys_id}>${group.name}</option>`)}</select></label>
            <button class="aiux-btn aiux-btn-primary aiux-btn-md" @click=${this.openCreateDialog} ?disabled=${this.loading || !this.selectedGroup}>${i18n.getMessage('Create sprint')}</button>
            <button class="aiux-btn aiux-btn-secondary aiux-btn-sm" @click=${this.load} ?disabled=${this.loading}>${i18n.getMessage('Refresh')}</button>
          </div>
        </header>

        ${this.error && !this.createOpen ? html`<div class="aiux-alert aiux-alert-error" role="alert"><span>${this.error}</span></div>` : ''}
        ${this.notice ? html`<div class="aiux-alert aiux-alert-success" role="status"><span>${this.notice}</span></div>` : ''}

        ${this.createOpen ? html`
          <aiux-modal .open=${this.createOpen} size="lg" @aiux-modal:close=${() => { this.createOpen = false; }}>
            <span slot="header">${i18n.getMessage('Create sprint')}</span>
            <form id="sprint-create-form" class="flex flex-col gap-5 p-1" @submit=${this.create}>
                <p class="text-sm text-base-content/70">${i18n.getMessage('Sprints will be created for {0}.', [this.groups.find(group => group.sys_id === this.selectedGroup)?.name || ''])}</p>
                ${this.error ? html`<div class="aiux-alert aiux-alert-error" role="alert"><span>${this.error}</span></div>` : ''}
                ${this.defaultsLoading ? html`<div class="flex items-center gap-3" role="status"><span class="aiux-loading aiux-loading-spinner aiux-loading-sm" aria-hidden="true"></span>${i18n.getMessage('Loading sprint defaults…')}</div>` : html`
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label class="flex flex-col gap-1"><span class="text-sm font-medium">${i18n.getMessage('Name')}</span><input class="aiux-input aiux-input-bordered aiux-input-md" .value=${this.name} @input=${event => { this.name = event.currentTarget.value; }} maxlength="150" required /></label>
                    <label class="flex flex-col gap-1"><span class="text-sm font-medium">${i18n.getMessage('Starting number')}</span><input class="aiux-input aiux-input-bordered aiux-input-md" type="number" min="1" step="1" .value=${this.startingNumber} @input=${event => { this.startingNumber = event.currentTarget.value; }} /></label>
                    <label class="flex flex-col gap-1"><span class="text-sm font-medium">${i18n.getMessage('Start date and time')}</span><input class="aiux-input aiux-input-bordered aiux-input-md" type="datetime-local" step="1" .value=${this.toDateTimeInputValue(this.startDate)} @input=${event => { this.startDate = event.currentTarget.value; }} required /></label>
                    <label class="flex flex-col gap-1"><span class="text-sm font-medium">${i18n.getMessage('Duration (days)')}</span><input class="aiux-input aiux-input-bordered aiux-input-md" type="number" min="1" max="365" step="1" .value=${this.duration} @input=${event => { this.duration = event.currentTarget.value; }} required /></label>
                    <label class="flex flex-col gap-1 sm:col-span-2"><span class="text-sm font-medium">${i18n.getMessage('Number of sprints')}</span><input class="aiux-input aiux-input-bordered aiux-input-md" type="number" min="1" max="100" step="1" .value=${this.sprintCount} @input=${event => { this.sprintCount = event.currentTarget.value; }} required /><span class="text-xs text-base-content/60">${i18n.getMessage('Additional sprints use consecutive numbers and dates based on the duration.')}</span></label>
                  </div>`}
                ${schedulePreview.length ? html`
                  <section aria-labelledby="schedule-preview-heading" class="flex flex-col gap-2">
                    <div><h3 id="schedule-preview-heading" class="text-sm font-semibold">${i18n.getMessage('Scheduled date and time')}</h3><p class="text-xs text-base-content/60">${i18n.getMessage('Shown in your timezone, as the sprint table displays these values.')}</p></div>
                    <div class="max-h-56 overflow-auto">
                      <table class="aiux-table aiux-table-sm w-full">
                        <caption class="sr-only">${i18n.getMessage('Sprint start and end date-times that will be saved')}</caption>
                        <thead><tr><th scope="col">${i18n.getMessage('Sprint')}</th><th scope="col">${i18n.getMessage('Start date and time')}</th><th scope="col">${i18n.getMessage('End date and time')}</th></tr></thead>
                        <tbody>${schedulePreview.map(row => html`<tr><th scope="row">${row.name || i18n.getMessage('Sprint')}</th><td><time>${row.start}</time></td><td><time>${row.end}</time></td></tr>`)}</tbody>
                      </table>
                    </div>
                  </section>` : ''}
            </form>
            <div slot="footer" class="flex justify-end gap-2"><button class="aiux-btn aiux-btn-secondary aiux-btn-md" type="button" @click=${this.closeCreateDialog} ?disabled=${this.creating}>${i18n.getMessage('Cancel')}</button><button class="aiux-btn aiux-btn-primary aiux-btn-md" type="submit" form="sprint-create-form" ?disabled=${this.creating || this.defaultsLoading || !this.selectedGroup}>${this.creating ? i18n.getMessage('Creating…') : i18n.getMessage('Create sprint(s)')}</button></div>
          </aiux-modal>` : ''}

        <section class="aiux-card" aria-labelledby="sprints-heading">
          <div class="aiux-card-header flex flex-col justify-between gap-3 px-6 pt-4 sm:flex-row sm:items-center">
              <div><h2 id="sprints-heading" class="aiux-card-header-title text-base">${i18n.getMessage('Sprints')}</h2><p class="mt-1 text-sm text-base-content/60">${i18n.getMessage('Only sprints assigned to your Agile Team groups are shown.')}</p></div>
          </div>
          <div class="aiux-card-body p-0">
            <div class="flex flex-col gap-3 border-b border-base-300 p-4 sm:flex-row sm:items-end">
              <label class="flex min-w-48 flex-1 flex-col gap-1"><span class="text-sm font-medium">${i18n.getMessage('Search sprints')}</span><input class="aiux-input aiux-input-bordered aiux-input-sm" type="search" .value=${this.searchTerm} @input=${event => { this.searchTerm = event.currentTarget.value; this.page = 1; }} placeholder=${i18n.getMessage('Search by sprint name')} /></label>
              <label class="flex flex-col gap-1 sm:min-w-48"><span class="text-sm font-medium">${i18n.getMessage('Status')}</span><select class="aiux-select aiux-select-bordered aiux-select-sm" .value=${this.statusFilter} @change=${event => { this.statusFilter = event.currentTarget.value; this.page = 1; }}><option value="">${i18n.getMessage('All statuses')}</option><option value="-6">${i18n.getMessage('Draft')}</option><option value="1">${i18n.getMessage('Planning')}</option><option value="2">${i18n.getMessage('Current')}</option><option value="3">${i18n.getMessage('Complete')}</option><option value="4">${i18n.getMessage('Cancelled')}</option></select></label>
            </div>
            ${this.loading ? html`<div class="flex items-center gap-3 p-8" role="status"><span class="aiux-loading aiux-loading-spinner aiux-loading-sm" aria-hidden="true"></span><span>${i18n.getMessage('Loading sprints…')}</span></div>`
              : filteredSprints.length === 0 ? html`<div class="flex flex-col items-center gap-2 p-8 text-center" role="status"><h3 class="text-base font-semibold">${i18n.getMessage('No sprints found')}</h3><p class="max-w-md text-sm text-base-content/60">${this.searchTerm || this.statusFilter ? i18n.getMessage('Try changing or clearing the search and status filters.') : i18n.getMessage('Create a sprint for one of your Agile Team groups to get started.')}</p></div>`
              : html`<div class="w-full overflow-x-auto"><table class="aiux-table aiux-table-md w-full min-w-[1200px] table-fixed text-base">
                  <caption class="sr-only">${i18n.getMessage('Sprints in your Agile Team groups, with start and end dates, status, and lifecycle actions')}</caption>
                  <colgroup><col class="w-[12%]" /><col class="w-[14%]" /><col class="w-[14%]" /><col class="w-[8%]" /><col class="w-[10%]" /><col class="w-[11%]" /><col class="w-[10%]" /><col class="w-[9%]" /><col class="w-[12%]" /></colgroup>
                  <thead><tr>${this.sortHeader('name', i18n.getMessage('Sprint'))}${this.sortHeader('start_date', i18n.getMessage('Start date and time'))}${this.sortHeader('end_date', i18n.getMessage('End date and time'))}${this.sortHeader('state_label', i18n.getMessage('Status'))}${this.sortHeader('team_points', i18n.getMessage('Group capacity points'))}${this.sortHeader('committed_points', i18n.getMessage('Total committed points'))}${this.sortHeader('story_points', i18n.getMessage('Current scope points'))}${this.sortHeader('actual_points', i18n.getMessage('Completed points'))}<th scope="col" class="px-3 py-2 text-base font-semibold">${i18n.getMessage('Actions')}</th></tr></thead>
                  <tbody>${visibleSprints.map(sprint => html`
                    <tr>
                      <th scope="row"><span class="block font-medium">${sprint.name}</span></th>
                      <td><time>${sprint.start_date}</time></td>
                      <td><time>${sprint.end_date}</time></td>
                      <td><span class="aiux-badge aiux-badge-md ${this.statusClass(sprint.state)} aiux-badge-outline text-sm">${sprint.state_label}</span></td>
                      <td class="text-center align-middle tabular-nums">${sprint.state === '-6'
                        ? this.editingCapacityId === sprint.sys_id
                          ? html`<div class="inline-flex min-w-36 items-center justify-center gap-2"><input class="aiux-input aiux-input-bordered aiux-input-sm w-24 text-center tabular-nums" type="number" min="0" step="any" .value=${sprint.team_points} data-capacity-input=${sprint.sys_id} aria-label=${i18n.getMessage('Group capacity points for {0}', [sprint.name])} ?disabled=${Boolean(this.actionId)} /><button class="aiux-btn aiux-btn-light aiux-btn-sm aiux-btn-circle" type="button" data-id=${sprint.sys_id} aria-label=${i18n.getMessage('Save group capacity points for {0}', [sprint.name])} ${tooltip({content: i18n.getMessage('Save capacity points')})} @click=${this.updateCapacity} ?disabled=${Boolean(this.actionId)}>${icon({name: 'check-outline', size: 'sm', class: 'text-success'})}</button><button class="aiux-btn aiux-btn-light aiux-btn-sm aiux-btn-circle" type="button" aria-label=${i18n.getMessage('Cancel editing group capacity points for {0}', [sprint.name])} ${tooltip({content: i18n.getMessage('Cancel editing')})} @click=${this.cancelCapacityEdit} ?disabled=${Boolean(this.actionId)}>${icon({name: 'close-outline', size: 'sm', class: 'text-error'})}</button></div>`
                          : html`<button class="aiux-btn aiux-btn-ghost aiux-btn-sm h-auto min-h-0 px-2 py-0 text-base leading-normal" type="button" aria-label=${i18n.getMessage('Group capacity points for {0}: {1}. Double-click to edit.', [sprint.name, sprint.team_points])} title=${i18n.getMessage('Double-click to edit')} @dblclick=${() => this.beginCapacityEdit(sprint.sys_id)} @keydown=${event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.beginCapacityEdit(sprint.sys_id); } }}>${sprint.team_points}</button>`
                        : sprint.team_points}</td>
                      <td class="text-center align-middle tabular-nums">${sprint.committed_points}</td>
                      <td class="text-center align-middle tabular-nums">${sprint.story_points}</td>
                      <td class="text-center align-middle tabular-nums">${sprint.actual_points}</td>
                      <td>${sprint.state === '2'
                        ? html`<button class="aiux-btn aiux-btn-primary aiux-btn-md" data-id=${sprint.sys_id} data-action="complete" aria-label=${i18n.getMessage('Complete {0}', [sprint.name])} @click=${this.changeState} ?disabled=${Boolean(this.actionId)}>${this.actionId === sprint.sys_id ? i18n.getMessage('Saving…') : i18n.getMessage('Complete sprint')}</button>`
                        : sprint.state === '-6' || sprint.state === '1'
                          ? html`<button class="aiux-btn aiux-btn-primary aiux-btn-md" data-id=${sprint.sys_id} data-action="start" aria-label=${i18n.getMessage('Start {0}', [sprint.name])} @click=${this.changeState} ?disabled=${Boolean(this.actionId)}>${this.actionId === sprint.sys_id ? i18n.getMessage('Saving…') : i18n.getMessage('Start sprint')}</button>`
                          : html`<span class="text-base text-base-content/50">${i18n.getMessage('No action')}</span>`}</td>
                    </tr>`
                  )}</tbody>
                </table></div>`}
            ${this.hasMore ? html`<p class="border-t border-base-300 p-4 text-sm text-base-content/70" role="status">${i18n.getMessage('Showing the first {0} sprints. Use the group selector above to narrow the list.', [this.sprints.length])}</p>` : ''}
            ${filteredSprints.length ? html`
              <footer class="flex flex-col gap-4 border-t border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-sm text-base-content/70" aria-live="polite">${i18n.getMessage('Showing {0}–{1} of {2} sprints', [startIndex + 1, rangeEnd, filteredSprints.length])}</p>
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label class="flex items-center gap-2 text-sm"><span>${i18n.getMessage('Records per page')}</span><select class="aiux-select aiux-select-bordered aiux-select-sm" .value=${String(this.pageSize)} @change=${event => { this.pageSize = Number(event.currentTarget.value); this.page = 1; }}><option value="5">5</option><option value="10">10</option><option value="15">15</option><option value="20">20</option></select></label>
                  ${totalPages > 1 ? html`<nav aria-label=${i18n.getMessage('Sprint list pagination')}><aiux-pagination-nav .totalPages=${totalPages} .currentPage=${currentPage} .showFirstLast=${true} .onchange=${event => { this.page = event.detail.page; }}></aiux-pagination-nav></nav>` : ''}
                </div>
              </footer>` : ''}
          </div>
        </section>
      </main>
    `;
  }
}
