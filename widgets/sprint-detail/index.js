import {html, css} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {AIUXWidgetElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {icon} from '@servicenow/aiux/aiux-directive-icon';
import {tooltip} from '@servicenow/aiux/aiux-directive-tooltip';
import '../../components/calculate-group-capacity/index.js';
import '../../components/sprint-stories/index.js';

const {name, description, bestFor, discoverable, server} = decorators;

@customElement('aiux-sprint-detail')
@name('Sprint Detail')
@description('Displays an Agile Team sprint in its Scrum form view.')
@bestFor('Read-only Scrum sprint details for current Agile Team group members.')
@discoverable(false)
@server('./server-script.js')
export default class SprintDetail extends AIUXWidgetElement {
  @property({type: String, attribute: 'sprint-id'}) sprintId = '';
  @state() sprint = null;
  @state() loading = true;
  @state() error = '';
  @state() editingCapacity = false;
  @state() capacityValue = '';
  @state() savingCapacity = false;
  @state() capacityError = '';
  @state() collapsed = true;

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has('sprintId')) this.loadSprint();
  }

  async loadSprint() {
    const requestedId = this.sprintId;
    this.loading = true;
    this.error = '';
    try {
      const response = await this.server.get({action: 'details', sysId: requestedId});
      if (this.sprintId !== requestedId) return;
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not load sprint details.'));
      this.sprint = response?.sprint || null;
      if (!this.sprint) this.error = i18n.getMessage('Sprint not found or you do not have access to it.');
    } catch (error) {
      if (this.sprintId === requestedId) this.error = error?.message || i18n.getMessage('Could not load sprint details.');
    } finally {
      if (this.sprintId === requestedId) this.loading = false;
    }
  }

  async beginCapacityEdit() {
    if (this.sprint?.state !== '-6' || this.savingCapacity) return;
    this.capacityValue = this.sprint.team_points ?? '';
    this.capacityError = '';
    this.editingCapacity = true;
    await this.updateComplete;
    this.renderRoot.querySelector('[data-capacity-input]')?.focus();
  }

  cancelCapacityEdit() {
    if (this.savingCapacity) return;
    this.editingCapacity = false;
    this.capacityError = '';
  }

  toggleDetails() {
    this.collapsed = !this.collapsed;
  }

  openCapacityContextMenu(event) {
    this.renderRoot.querySelector('aiux-calculate-group-capacity')?.openContextMenu(
      event,
      this.sprint?.sys_id,
      this.sprint?.state === '-6'
    );
  }

  handleCapacityApplied(event) {
    const {teamPoints, sprint} = event.detail;
    this.sprint = sprint || {...this.sprint, team_points: teamPoints};
    this.capacityValue = teamPoints;
  }

  handleStoriesUpdated(event) {
    if (event.detail?.sprint) {
      this.sprint = event.detail.sprint;
      this.capacityValue = event.detail.sprint.team_points ?? this.capacityValue;
    }
  }

  async saveCapacity() {
    const value = String(this.capacityValue).trim();
    if (!value || !Number.isFinite(Number(value)) || Number(value) < 0) {
      this.capacityError = i18n.getMessage('Enter a valid non-negative group capacity.');
      return;
    }

    this.savingCapacity = true;
    this.capacityError = '';
    try {
      const response = await this.server.get({
        action: 'update_capacity',
        sysId: this.sprint.sys_id,
        teamPoints: value
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Group capacity points could not be updated.'));
      this.sprint = response?.sprint || this.sprint;
      this.editingCapacity = false;
    } catch (error) {
      this.capacityError = error?.message || i18n.getMessage('Group capacity points could not be updated.');
    } finally {
      this.savingCapacity = false;
    }
  }

  statusClass(state) {
    if (state === '2') return 'aiux-badge-success';
    if (state === '3') return 'aiux-badge-neutral';
    if (state === '4') return 'aiux-badge-error';
    if (state === '1') return 'aiux-badge-info';
    return 'aiux-badge-warning';
  }

  field(label, value) {
    return html`<div class="flex min-w-0 flex-col gap-1 border-b border-base-200 py-3">
      <dt class="text-sm font-medium text-text-secondary">${label}</dt>
      <dd class="whitespace-pre-wrap break-words text-base text-text-primary">${value || i18n.getMessage('Not set')}</dd>
    </div>`;
  }

  capacityField() {
    const label = i18n.getMessage('Group capacity points');
    return html`<div class="flex min-w-0 flex-col gap-1 border-b border-base-200 py-3">
      <dt class="text-sm font-medium text-text-secondary">${label}</dt>
      <dd class="min-h-9 whitespace-pre-wrap break-words text-base text-text-primary">
        ${this.editingCapacity ? html`<div class="flex flex-wrap items-center gap-2">
          <input class="aiux-input aiux-input-sm w-32 text-base tabular-nums" type="number" min="0" step="any" data-capacity-input .value=${this.capacityValue} aria-label=${label} @input=${event => { this.capacityValue = event.currentTarget.value; }} @keydown=${event => { if (event.key === 'Enter') this.saveCapacity(); if (event.key === 'Escape') this.cancelCapacityEdit(); }} ?disabled=${this.savingCapacity} />
          <button class="aiux-btn aiux-btn-light aiux-btn-sm aiux-btn-circle" type="button" aria-label=${i18n.getMessage('Save group capacity points')} ${tooltip({content: i18n.getMessage('Save capacity points')})} @click=${this.saveCapacity} ?disabled=${this.savingCapacity}>${icon({name: 'check', size: 'sm', class: 'text-success'})}</button>
          <button class="aiux-btn aiux-btn-light aiux-btn-sm aiux-btn-circle" type="button" aria-label=${i18n.getMessage('Cancel editing group capacity points')} ${tooltip({content: i18n.getMessage('Cancel editing')})} @click=${this.cancelCapacityEdit} ?disabled=${this.savingCapacity}>${icon({name: 'close', size: 'sm', class: 'text-error'})}</button>
        </div>` : this.sprint.state === '-6' ? html`<button class="aiux-btn aiux-btn-ghost aiux-btn-sm h-auto min-h-0 px-2 py-0 text-base leading-normal" type="button" aria-label=${i18n.getMessage('Group capacity points: {0}. Double-click to edit. Right-click for more options.', [this.sprint.team_points || i18n.getMessage('Not set')])} title=${i18n.getMessage('Double-click to edit, right-click for options')} @dblclick=${this.beginCapacityEdit} @contextmenu=${this.openCapacityContextMenu} @keydown=${event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.beginCapacityEdit(); } }}>${this.sprint.team_points || i18n.getMessage('Not set')}</button>` : (this.sprint.team_points || i18n.getMessage('Not set'))}
      </dd>
      ${this.capacityError ? html`<p class="text-sm text-error" role="alert">${this.capacityError}</p>` : ''}
    </div>`;
  }

  render() {
    if (this.loading) {
      return html`<article class="aiux-card px-6 py-4" role="status" aria-label=${i18n.getMessage('Loading sprint details…')}>
        <div class="flex w-full flex-wrap items-center gap-x-6 gap-y-4">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <div class="aiux-skeleton h-6 w-44 rounded"></div>
            <div class="aiux-skeleton h-6 w-20 rounded-full"></div>
          </div>
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
            <div class="flex min-w-0 flex-col gap-1.5">
              <div class="aiux-skeleton h-3.5 w-28 rounded"></div>
              <div class="aiux-skeleton h-5 w-12 rounded"></div>
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <div class="aiux-skeleton h-3.5 w-28 rounded"></div>
              <div class="aiux-skeleton h-5 w-12 rounded"></div>
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <div class="aiux-skeleton h-3.5 w-24 rounded"></div>
              <div class="aiux-skeleton h-5 w-12 rounded"></div>
            </div>
          </div>
          <div class="aiux-skeleton h-8 w-8 rounded-full ms-auto shrink-0"></div>
        </div>
        <span class="sr-only">${i18n.getMessage('Loading sprint details…')}</span>
      </article>`;
    }
    if (this.error) return html`<div class="aiux-alert aiux-alert-error" role="alert">${this.error}</div>`;
    if (!this.sprint) return '';

    const sprint = this.sprint;
    return html`<article class="aiux-card">
      <header class="aiux-card-header px-6 py-4">
        <div class="flex w-full flex-wrap items-center gap-x-6 gap-y-4">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h1 id="sprint-detail-title" class="aiux-card-header-title min-w-0 break-words text-base text-text-primary">${sprint.name}</h1>
            <span class="shrink-0 aiux-badge aiux-badge-md ${this.statusClass(sprint.state)} aiux-badge-outline">${sprint.state_label}</span>
          </div>
          ${this.collapsed ? html`<dl class="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
            <div class="flex min-w-0 flex-col gap-1"><dt class="text-sm text-text-secondary">${i18n.getMessage('Group capacity points')}</dt><dd class="m-0 break-words text-base text-text-primary tabular-nums">${sprint.team_points || '—'}</dd></div>
            <div class="flex min-w-0 flex-col gap-1"><dt class="text-sm text-text-secondary">${i18n.getMessage('Total committed points')}</dt><dd class="m-0 break-words text-base text-text-primary tabular-nums">${sprint.committed_points || '—'}</dd></div>
            <div class="flex min-w-0 flex-col gap-1"><dt class="text-sm text-text-secondary">${i18n.getMessage('Completed points')}</dt><dd class="m-0 break-words text-base text-text-primary tabular-nums">${sprint.actual_points || '—'}</dd></div>
          </dl>` : ''}
          <button class="aiux-btn aiux-btn-ghost aiux-btn-sm aiux-btn-circle ms-auto shrink-0" type="button" aria-controls="sprint-details-panel" aria-expanded=${String(!this.collapsed)} aria-label=${this.collapsed ? i18n.getMessage('Expand sprint details') : i18n.getMessage('Collapse sprint details')} ${tooltip({content: this.collapsed ? i18n.getMessage('Expand sprint details') : i18n.getMessage('Collapse sprint details'), showDelay: 300})} @click=${this.toggleDetails}><span class=${`transition-transform duration-[var(--duration-sm)] [transition-timing-function:var(--ease-medium-accel)] motion-reduce:transition-none ${this.collapsed ? 'rotate-0' : 'rotate-180'}`}>${icon({name: 'chevron-down', size: 'sm'})}</span></button>
        </div>
      </header>
      <div id="sprint-details-panel" class="group grid grid-rows-[1fr] transition-[grid-template-rows] duration-[var(--duration-lg)] [transition-timing-function:var(--ease-medium-accel)] data-[collapsed=true]:grid-rows-[0fr] data-[collapsed=true]:duration-[var(--duration-md)] motion-reduce:transition-none" data-collapsed=${String(this.collapsed)} aria-hidden=${String(this.collapsed)} .inert=${this.collapsed}>
      <div class="min-h-0 overflow-hidden">
      <div class="aiux-card-body transition-opacity duration-[var(--duration-sm)] [transition-timing-function:linear] group-data-[collapsed=true]:opacity-0 group-data-[collapsed=true]:duration-[var(--duration-xs)] motion-reduce:transition-none px-6 pb-6 pt-4">
        <section aria-labelledby="sprint-overview-heading">
          <h2 id="sprint-overview-heading" class="text-lg font-semibold text-text-primary">${i18n.getMessage('Sprint overview')}</h2>
          <dl class="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            ${this.field(i18n.getMessage('Number'), sprint.number)}
            ${this.field(i18n.getMessage('Agile Team group'), sprint.assignment_group)}
            ${this.field(i18n.getMessage('Total committed points'), sprint.committed_points)}
            ${this.field(i18n.getMessage('Current scope points'), sprint.story_points)}
            ${this.field(i18n.getMessage('Completed points'), sprint.actual_points)}
          </dl>
        </section>
        <section class="mt-6" aria-labelledby="sprint-schedule-capacity-heading">
          <h2 id="sprint-schedule-capacity-heading" class="text-lg font-semibold text-text-primary">${i18n.getMessage('Schedule and capacity')}</h2>
          <dl class="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            ${this.field(i18n.getMessage('Start date and time'), sprint.start_date)}
            ${this.field(i18n.getMessage('End date and time'), sprint.end_date)}
            ${this.capacityField()}
          </dl>
        </section>
        ${sprint.description ? html`<section class="mt-6" aria-labelledby="sprint-description-heading">
          <h2 id="sprint-description-heading" class="text-lg font-semibold text-text-primary">${i18n.getMessage('Description')}</h2>
          <p class="mt-2 whitespace-pre-wrap break-words text-base text-text-primary">${sprint.description}</p>
        </section>` : ''}
      </div>
      </div>
      </div>
    </article>
    <aiux-calculate-group-capacity
      .server=${this.server}
      .sprintId=${sprint.sys_id}
      .isDraft=${sprint.state === '-6'}
      @apply=${this.handleCapacityApplied}>
    </aiux-calculate-group-capacity>
    <aiux-sprint-stories
      .server=${this.server}
      .sprintId=${sprint.sys_id}
      .groupId=${sprint.assignment_group_id || ''}
      .isDraft=${sprint.state === '-6'}
      @stories-updated=${this.handleStoriesUpdated}>
    </aiux-sprint-stories>`;
  }
}
