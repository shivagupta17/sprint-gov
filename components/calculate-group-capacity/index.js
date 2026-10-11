import {html, css, nothing} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {icon} from '@servicenow/aiux/aiux-directive-icon';

@customElement('aiux-calculate-group-capacity')
export default class CalculateGroupCapacity extends AIUXElement {
  @property({attribute: false}) server = null;
  @property({type: String, attribute: 'sprint-id'}) sprintId = '';
  @property({type: Boolean, attribute: 'is-draft'}) isDraft = true;

  @state() contextMenuOpen = false;
  @state() contextMenuPosition = {x: 0, y: 0};
  @state() calculateModalOpen = false;
  @state() members = [];
  @state() loadingMembers = false;
  @state() membersError = '';
  @state() savingCapacity = false;

  static styles = css`
    :host {
      display: contents;
    }
    .context-menu {
      position: fixed;
      z-index: 9998;
      background: var(--color-base-100, #ffffff);
      border: 1px solid var(--color-base-300, #e5e7eb);
      border-radius: var(--rounded-box, 0.5rem);
      box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
      min-width: 200px;
      padding: 0.25rem;
    }
    .context-menu-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      border-radius: var(--rounded-btn, 0.25rem);
      font-size: 0.875rem;
      color: var(--color-text-primary, #000000);
      transition: background-color var(--duration-sm, 150ms) linear;
    }
    .context-menu-item:hover {
      background-color: var(--color-base-200, #f2f2f2);
    }
    .context-menu-item:focus {
      outline: 2px solid var(--color-primary, #0f62fe);
      outline-offset: -2px;
    }
  `;

  constructor() {
    super();
    this.handleOutsideClick = this.handleOutsideClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  openContextMenu(event, sprintId, isDraft = true) {
    event.preventDefault();
    if (sprintId) this.sprintId = sprintId;
    this.isDraft = isDraft;
    this.contextMenuPosition = {x: event.clientX, y: event.clientY};
    this.contextMenuOpen = true;
    document.addEventListener('keydown', this.handleKeyDown);
    this.updateComplete.then(() => {
      document.addEventListener('click', this.handleOutsideClick);
    });
  }

  closeContextMenu() {
    this.contextMenuOpen = false;
    document.removeEventListener('click', this.handleOutsideClick);
    if (!this.calculateModalOpen) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  openCalculateModal(sprintId) {
    if (sprintId) this.sprintId = sprintId;
    this.closeContextMenu();
    this.calculateModalOpen = true;
    this.loadMembers();
  }

  closeCalculateModal() {
    this.calculateModalOpen = false;
    document.removeEventListener('keydown', this.handleKeyDown);
    this.dispatchEvent(new CustomEvent('close', {bubbles: true, composed: true}));
  }

  async loadMembers() {
    if (!this.server || !this.sprintId) {
      this.loadingMembers = false;
      return;
    }
    this.loadingMembers = true;
    this.membersError = '';
    try {
      const response = await this.server.get({
        action: 'get_group_members',
        sysId: this.sprintId
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Could not load group members.'));
      this.members = (response?.members || []).map(member => ({
        ...member,
        reduce_points: ''
      }));
    } catch (error) {
      this.membersError = error?.message || i18n.getMessage('Could not load group members.');
    } finally {
      this.loadingMembers = false;
    }
  }

  handleReducePointsInput(sysId, event) {
    const raw = event.target.value;
    this.members = this.members.map(member => {
      if (member.sys_id === sysId) {
        return {
          ...member,
          reduce_points: raw
        };
      }
      return member;
    });
  }

  resetReducePoints() {
    this.members = this.members.map(member => ({
      ...member,
      reduce_points: ''
    }));
  }

  get totalAveragePoints() {
    return this.members.reduce((sum, m) => sum + (Number(m.average_points) || 0), 0);
  }

  get totalReducePoints() {
    return this.members.reduce((sum, m) => {
      const val = Number(m.reduce_points);
      return sum + (Number.isFinite(val) && val > 0 ? val : 0);
    }, 0);
  }

  get calculatedGroupCapacity() {
    const total = this.members.reduce((sum, m) => {
      const avg = Number(m.average_points) || 0;
      const red = Number(m.reduce_points);
      const reduceVal = Number.isFinite(red) && red > 0 ? red : 0;
      return sum + Math.max(0, avg - reduceVal);
    }, 0);
    return Math.round(total);
  }

  async applyCalculatedCapacity() {
    if (!this.isDraft || this.savingCapacity || !this.server || !this.sprintId) return;
    const value = String(this.calculatedGroupCapacity);
    this.savingCapacity = true;
    this.membersError = '';
    try {
      const response = await this.server.get({
        action: 'update_capacity',
        sysId: this.sprintId,
        teamPoints: value
      });
      if (response?.isError) throw new Error(response.errorMessage || i18n.getMessage('Group capacity points could not be updated.'));
      this.dispatchEvent(new CustomEvent('apply', {
        bubbles: true,
        composed: true,
        detail: {
          sprintId: this.sprintId,
          teamPoints: value,
          sprint: response?.sprint,
          sprints: response?.sprints
        }
      }));
      this.closeCalculateModal();
    } catch (error) {
      this.membersError = error?.message || i18n.getMessage('Group capacity points could not be updated.');
    } finally {
      this.savingCapacity = false;
    }
  }

  handleKeyDown(event) {
    if (event.key === 'Escape') {
      if (this.calculateModalOpen) {
        this.closeCalculateModal();
      } else if (this.contextMenuOpen) {
        this.closeContextMenu();
      }
    }
  }

  handleOutsideClick(event) {
    if (this.contextMenuOpen && !event.target.closest('.context-menu')) {
      this.closeContextMenu();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  render() {
    return html`
      ${this.contextMenuOpen ? html`
        <div class="context-menu" data-style-skip style="left: ${this.contextMenuPosition.x}px; top: ${this.contextMenuPosition.y}px;" role="menu" tabindex="0" aria-label=${i18n.getMessage('Group capacity options')}>
          <div class="context-menu-item" role="menuitem" tabindex="0" @click=${() => this.openCalculateModal(this.sprintId)} @keydown=${event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.openCalculateModal(this.sprintId); } }}>
            ${icon({name: 'formula', size: 'sm'})}
            <span>${i18n.getMessage('Calculate group capacity')}</span>
          </div>
        </div>
      ` : nothing}

      ${this.calculateModalOpen ? html`
        <aiux-modal .open=${this.calculateModalOpen} size="lg" close-on-backdrop @aiux-modal:close=${this.closeCalculateModal}>
          <span slot="header" class="text-xl font-normal text-text-primary">${i18n.getMessage('Calculate Group Capacity')}</span>
          <div class="flex flex-col gap-4">
            ${this.loadingMembers ? html`<div class="space-y-3 py-4" role="status" aria-label=${i18n.getMessage('Loading group members…')}>
              <div class="aiux-skeleton h-10 w-full rounded"></div>
              <div class="aiux-skeleton h-10 w-full rounded"></div>
              <div class="aiux-skeleton h-10 w-full rounded"></div>
              <span class="sr-only">${i18n.getMessage('Loading group members…')}</span>
            </div>` : this.membersError ? html`<div class="aiux-alert aiux-alert-error" role="alert"><span>${this.membersError}</span></div>` : this.members.length === 0 ? html`<p class="text-base text-text-secondary">${i18n.getMessage('No members found in this group.')}</p>` : html`
              <div class="overflow-x-auto">
                <table class="aiux-table aiux-table-sm w-full">
                  <thead>
                    <tr class="border-b border-base-300">
                      <th scope="col" class="text-left py-2.5 px-3 text-sm font-semibold text-text-primary">${i18n.getMessage('Member')}</th>
                      <th scope="col" class="text-right py-2.5 px-3 text-sm font-semibold text-text-primary">${i18n.getMessage('Average Points per Sprint')}</th>
                      <th scope="col" class="text-right py-2.5 px-3 text-sm font-semibold text-text-primary">${i18n.getMessage('Reduce Points')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.members.map(member => {
                      const avg = Number(member.average_points) || 0;
                      const reduceVal = member.reduce_points === '' ? '' : member.reduce_points;
                      return html`
                        <tr class="border-b border-base-200 hover:bg-base-200 transition-colors">
                          <td class="py-2.5 px-3 text-base text-text-primary font-medium">${member.user_name}</td>
                          <td class="py-2.5 px-3 text-right text-base text-text-primary tabular-nums">${avg}</td>
                          <td class="py-2 px-3 text-right">
                            <div class="inline-flex justify-end">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                class="aiux-input aiux-input-sm w-24 text-right tabular-nums"
                                .value=${reduceVal}
                                placeholder="0"
                                aria-label=${i18n.getMessage('Reduce points for {0}', [member.user_name])}
                                @input=${event => this.handleReducePointsInput(member.sys_id, event)}
                              />
                            </div>
                          </td>
                        </tr>
                      `;
                    })}
                  </tbody>
                  <tfoot>
                    <tr class="border-t-2 border-base-300 bg-base-200 font-semibold">
                      <td class="py-2.5 px-3 text-sm text-text-primary">${i18n.getMessage('Total')}</td>
                      <td class="py-2.5 px-3 text-right text-sm text-text-primary tabular-nums">${this.totalAveragePoints}</td>
                      <td class="py-2.5 px-3 text-right text-sm text-text-primary tabular-nums">${this.totalReducePoints}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div class="p-4 rounded-box bg-base-200 border border-base-300 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span class="text-xs uppercase tracking-wider text-text-secondary font-semibold">${i18n.getMessage('Calculated Group Capacity')}</span>
                  <div class="flex items-baseline gap-2 mt-0.5">
                    <span class="text-2xl font-bold text-text-primary tabular-nums">${this.calculatedGroupCapacity}</span>
                    <span class="text-sm text-text-secondary">${i18n.getMessage('points')}</span>
                  </div>
                </div>
                <div class="text-xs text-text-secondary text-right">
                  <span>${i18n.getMessage('Total average: {0} • Total reduced: {1}', [this.totalAveragePoints, this.totalReducePoints])}</span>
                </div>
              </div>
            `}
          </div>
          <div slot="footer" class="flex justify-between items-center w-full gap-2">
            <button class="aiux-btn aiux-btn-ghost aiux-btn-sm" type="button" @click=${this.resetReducePoints} ?disabled=${this.totalReducePoints === 0}>
              ${i18n.getMessage('Reset')}
            </button>
            <div class="flex gap-2">
              <button class="aiux-btn aiux-btn-secondary" type="button" @click=${this.closeCalculateModal}>
                ${i18n.getMessage('Close')}
              </button>
              ${this.isDraft ? html`
                <button class="aiux-btn aiux-btn-primary" type="button" @click=${this.applyCalculatedCapacity} ?disabled=${this.savingCapacity || this.members.length === 0}>
                  ${this.savingCapacity ? html`<span class="aiux-loading aiux-loading-spinner aiux-loading-xs" aria-hidden="true"></span> ${i18n.getMessage('Applying…')}` : i18n.getMessage('Apply to Sprint')}
                </button>
              ` : nothing}
            </div>
          </div>
        </aiux-modal>
      ` : nothing}
    `;
  }
}
