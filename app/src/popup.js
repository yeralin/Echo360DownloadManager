let mediaLessons = undefined;
const shouldDownload = true;
let downloadHD = false;
let downloadables = [];
let filtered = [];

// Pleb programming.
function noobDebugging(lesson) {
  console.log("lesson: " + lesson);
  console.log("lesson.isFuture: " + lesson.isFuture);
  console.log("lesson.lesson: " + lesson.lesson);
  console.log("lesson.lesson.id: " + lesson.lesson.id);
  console.log("lesson.lesson.updatedAt: " + lesson.lesson.updatedAt);
}

function canDownload(lesson) {
  let downloadable = (lesson.isFuture === false && lesson.hasAvailableVideo === true && lesson.video != null && lesson.video.media && lesson.video.media.media);
  return downloadable;
}

function getVideoFileName(lesson) {
  // ES6 allows you to do this.
  // Old: const updatedAt = lesson.lesson.updatedAt;
  // Old: const age, name = person.age, person.name
  // New: const {age, name} = person;
  const {updatedAt} = lesson.video.media;
  const quality = (downloadHD) ? "_HD" : "_SD";
  return updatedAt.slice(0, updatedAt.indexOf("T")) + quality + ".mp4";
}

// Returns only unit code.
function getUnitCode(lesson) {
  const lectureName = lesson.lesson.name;
  var unitCodeTrailing = lectureName.slice(0, lectureName.indexOf("/"));
  try {
    return unitCodeTrailing.split("_")[0];
  } catch (err) {
    // Some Universities may have weird formats.
    return unitCodeTrailing;
  }
}

function getDownloadLink(lesson) {
  // Expected case: lesson.video.media.media.current gives array of downloadable links.
  // Unexpected case: no attribute current (see unkown issues).
  // TODO: Handle this.
  const {primaryFiles} = lesson.video.media.media.current;
  if (downloadHD) {
    const {s3Url, width, height} = primaryFiles[1];
    // TODO: URL for access outside of Australia.
    return "https://echo360.org.au/media/download?s3Url=" + s3Url + "&fileName=hd1.mp4&resolution=" + width.toString() + "x" + height.toString();
  } else {
    const {s3Url, width, height} = primaryFiles[0];
    return "https://echo360.org.au/media/download?s3Url=" + s3Url + "&fileName=sd1.mp4&resolution=" + width.toString() + "x" + height.toString();
  }
}

// Job of this function is to listen init mediaLessons once per click.
function webRequestOnComplete(xhrRequest) {
  console.log("Media Lessons obtained!");

  if (mediaLessons === undefined) {
    mediaLessons = xhrRequest;
    // Now perform the request again ourselves and download files.
    var getMediaLessonsRequest = new Request(mediaLessons.url, {method: 'GET'});
    fetch(
      getMediaLessonsRequest,
      {
        method: 'GET',
            credentials: 'include'
      })
      .then((getMediaLessonsResponse) => getMediaLessonsResponse.json())
      .then((getMediaLessonsJson) => {
        console.log(getMediaLessonsJson);
        getMediaLessonsJson.data.forEach((dataItem) => {
          var lessons = dataItem.lessons;
          downloadables = lessons.filter((lesson) => {
            return canDownload(lesson);
          });
          downloadables.sort((a, b) => {
            const nameA = getVideoFileName(a), nameB = getVideoFileName(b);
            if (nameA < nameB) return -1;
            else if (nameA == nameB) return 0;
            else return 1;
          });

          const lectureSelect = document.getElementById("lectureSelect");
          downloadables.forEach((downloadable) => {
            const option = document.createElement("option");
            option.defaultSelected = true;
            const name = getUnitCode(downloadable) + "_" + getVideoFileName(downloadable);

            option.innerHTML = name;
            lectureSelect.appendChild(option);
          });

          var downloadButton = document.getElementById('download');
          downloadButton.disabled = false;
        });
      });
  }
}

function pageSetup(){
    chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
        var currentTab = tabs[0].url;
        console.log(currentTab);
        var domain = currentTab.match(/^[\w-]+:\/{2,}\[?([\w\.:-]+)\]?(?::[0-9]*)?/)[1];
        console.log(domain)
        if(domain !== "echo360.org.au"){
            document.getElementById("load").setAttribute("disabled",true);
            document.getElementById("downloadHD").setAttribute("disabled", true);
            document.getElementById("mainBlock").setAttribute("hidden", true);
            document.getElementById("invalidMsg").removeAttribute("hidden")
        }
    });
}

// No longer needed -Cal
// // BEGIN EXPERIMENTAL BLOCK
// // THIS BLOCK IS AN ALTERANTIVE FOR PUSHING DOWNLOADS
// // SOURCES: https://developer.chrome.com/extensions/downloads#event-onChanged, http://stackoverflow.com/questions/12552803/looping-through-array-with-callback
//
// function ExectureDownload(){
//     performDownload(array[0])
// }
//
// function nextDownload(){
//     if(array.count = index - 1){
//         index = 0;
//         return;
//     } else {
//         performDownload(array[index])
//     }
// }
//
// function performDownload(url){
//     chrome.downloads.download({
//             url: getDownloadLink(downloadable),
//             filename: "Echo360_Lectures/" + unitCode + "/" + saveFileAs
//         }, function callback(downloadId){
//             console.log(downloadId);
//             var currentDownload = {
//                 id: downloadId
//             }
//             chrome.downloads.search(currentDownload, function test(result){
//                 console.log(result[0]);
//             })
//             chrome.downloads.onChanged.addListener(nextDownload())
//         }
//     );
// }
// //END EXPERIMENTAL BLOCK

document.addEventListener('DOMContentLoaded', function() {
    pageSetup();
    // Add load button onclick. To refresh page to populate
    var loadButton = document.getElementById('load');
    loadButton.addEventListener('click', function () {
        downloadHD = (document.getElementById("downloadHD").checked) ? true : false;

        chrome.webRequest.onCompleted.addListener(webRequestOnComplete, {urls: ["*://echo360.org.au/*/media_lessons"]});

        chrome.tabs.getSelected(null, function (tab) {
          var code = 'window.location.reload();';
          chrome.tabs.executeScript(tab.id, {code: code});
        });
    }, false);

    // Add download button onclick.
    var downloadButton = document.getElementById('download');
    downloadButton.disabled = true;
    downloadButton.addEventListener('click', function () {
      downloadHD = (document.getElementById("downloadHD").checked) ? true : false;

      const lectureSelect = document.getElementById("lectureSelect");
      const options = lectureSelect.options;

      let selected = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].selected)
          selected.push(i);
      }

      // Using index as unique ID, since dates are not unique.
      let toDownload = [];
      for (let i = 0; i < downloadables.length; i++) {
        if (selected.indexOf(i) != -1)
          toDownload.push(downloadables[i]);
      }

      const port = chrome.runtime.connect();
      port.postMessage(toDownload, downloadHD);
      downloadButton.disabled = true;
      mediaLessons = undefined;
      return;
    }, false);

}, false);
