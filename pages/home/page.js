import {html} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement, decorators} from '@servicenow/aiux/aiux-components-core';
import '../../widgets/sprint-management/index.js';

const {global} = decorators;

@customElement('x-snc-sprint-gov-home-page')
@global(false)
export default class SprintPlanningPage extends AIUXElement {
  render() {
    return html`<aiux-sprint-management></aiux-sprint-management>`;
  }
}
