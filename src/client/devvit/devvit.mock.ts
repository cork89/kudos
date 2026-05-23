type NavigateTarget =
  | string
  | {
      readonly url: string;
      readonly permalink?: string;
    };

function navigateTo(target: NavigateTarget) {
  if (typeof target === 'string') {
    window.location.href = target;
    return;
  }

  const url =
    target.permalink !== undefined
      ? new URL(target.permalink, 'https://www.reddit.com').toString()
      : target.url;
  window.open(url, '_blank', 'noopener,noreferrer');
}

const context = {
  userId: 't2_test',
};

function requestExpandedMode(_event: any, expandTo: string) {
  const baseURL = window.location.origin;
  window.location.href = `${baseURL}/${expandTo}.html`;
}

export { navigateTo, context, requestExpandedMode };
