import {html} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {navigate} from '@servicenow/aiux-client';
import {i18n} from '@servicenow/aiux/aiux-services';
import '../../../widgets/sprint-detail/index.js';

const {global} = decorators;

@customElement('x-snc-sprint-gov-sprint-detail-page')
@global(false)
export default class SprintDetailPage extends AIUXElement {
  static async loader(ctx) {
    return {id: ctx.params.id};
  }

  render() {
    const {id} = this.loaderData || {};
    return html`<main class="p-4 sm:p-6">
      <button class="aiux-btn aiux-btn-secondary aiux-btn-md" type="button" @click=${() => navigate('/home')}>
        ${i18n.getMessage('Back to Sprint Planning')}
      </button>
      <aiux-sprint-detail class="mt-6 block" sprint-id=${id || ''}></aiux-sprint-detail>
    </main>`;
  }
}
