function navigateTo(url: string) {
    window.location.href = url
}

const context = {

}

function requestExpandedMode(_event: any, expandTo: string) {
    const baseURL = window.location.origin;
    window.location.href = `${baseURL}/${expandTo}.html`;
}

export { navigateTo, context, requestExpandedMode };