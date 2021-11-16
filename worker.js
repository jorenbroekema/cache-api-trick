onmessage = (ev) => {
  importScripts('/foo/bar.js');
  console.log(_UMD_EXPORT_); // PROFIT!!!
};
