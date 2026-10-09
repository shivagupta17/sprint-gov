const APP_NAME = 'sprint-gov';

export function setDocumentTitle(pageTitle) {
  if (typeof document === 'undefined') return;
  document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
}
