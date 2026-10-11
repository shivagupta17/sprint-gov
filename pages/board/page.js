import {html} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {setDocumentTitle} from '../../utils/document-title.js';
import '../../widgets/agile-board/index.js';

const {global} = decorators;

@customElement('x-snc-sprint-gov-board-page')
@global(false)
export default class AgileBoardPage extends AIUXElement {
  firstUpdated() {
    super.firstUpdated();
    setDocumentTitle(i18n.getMessage('Agile Board - Daily Standup'));
  }

  render() {
    return html`<main class="block w-full h-full min-h-screen p-4 sm:p-6" role="main">
      <aiux-agile-board class="block w-full"></aiux-agile-board>
    </main>`;
  }
}
