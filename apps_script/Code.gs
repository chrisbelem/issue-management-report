function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Issues & Action Plans — Global Lending')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
