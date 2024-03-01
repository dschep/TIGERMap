document.addEventListener("alpine:init", async () => {
  Alpine.store("tilesets_loaded", false);

  let is_local = new URL(location.href).port == "8080";
  let url_prefix;
  if (is_local) {
    url_prefix = "http://127.0.0.1:8080/data/";
  } else {
    url_prefix = "https://pub-45b39ea7c4e84b9bac2b3568e1dced89.r2.dev/";
  }

  // add the PMTiles plugin to the maplibregl global.
  let protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  map = new maplibregl.Map({
    container: "map",
    zoom: 4,
    hash: "map",
    center: [-91, 39.0],
    style: {
      version: 8,
      layers: mapstyle_layers,
      glyphs: "./font/{fontstack}/{range}.pbf",
      sources: {
        tiger: {
          type: "vector",
          url: "pmtiles://"+ url_prefix + "us-latest.pmtiles",
          attribution:
            '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        },
        streetaddress: {
          type: "vector",
          url: "pmtiles://"+ url_prefix + "us-latest-streetaddress.pmtiles",
          attribution:
            '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        },
        redlined: {
          type: "vector",
          url: "pmtiles://"+ url_prefix + "redlining-grade-d.pmtiles",
          attribution:
            '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        },
        osmcarto: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution:
            '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        },
      },
    },
  });
  // Add geolocate control to the map.
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
    }),
  );
  map.addControl(new maplibregl.NavigationControl());
  

  map.setPadding({ top: 57 });

  map.on("load", () => {
    let select = document.querySelector("#selected_tileset");
    select.addEventListener("change", (e) => {
      let new_key = e.target.value;
      console.assert(new_key != undefined);
      let selected_tileset = tilesets.tilesets.find((el) => el.key == new_key);
      console.assert(selected_tileset != undefined);
      var loc = new URLSearchParams((location.hash ?? "#").substr(1));
      loc.set("tiles", new_key);
      location.hash = "#" + loc.toString();
      map.getSource("waterway").setUrl("pmtiles://" + selected_tileset.url);
    });
  });
});

function decodeFilterParams(s) {
  let filter_regex = /(?<min_filter>\d+)?\.\.(?<max_filter>\d+)?/;
  let groups = s.match(filter_regex)?.groups ?? {};
  let min_filter_enabled = (groups["min_filter"] ?? "0") != "0";
  let max_filter_enabled = (groups["max_filter"] ?? "inf") != "inf";
  let min_filter = parseInt(groups.min_filter ?? "0", 10);
  let max_filter;
  if ((groups["max_filter"] ?? "inf") == "inf") {
    max_filter = null;
  } else {
    max_filter = parseInt(groups.max_filter ?? "0", 10);
  }
  return {
    min_filter_enabled: min_filter_enabled,
    min_filter: min_filter,
    max_filter_enabled: max_filter_enabled,
    max_filter: max_filter,
  };
}

function encodeFilterParams(
  min_filter_enabled,
  min_filter,
  max_filter_enabled,
  max_filter,
) {
  let result = "";
  if (!min_filter_enabled && !max_filter_enabled) {
    return "";
  }
  if (min_filter_enabled) {
    result += `${min_filter}`;
  } else {
    result += "0";
  }

  if (min_filter_enabled || max_filter_enabled) {
    result += "..";
  }
  if (max_filter_enabled) {
    result += `${max_filter}`;
  } else {
    result += "inf";
  }
  return result;
}

function filterParamsChanged(len_filter) {
  let params = new URLSearchParams((location.hash ?? "#").substr(1));
  params.delete("min_len");
  params.delete("min_len_unit");
  params.delete("max_len");
  params.delete("max_len_unit");
  let encoded_len = encodeFilterParams(
    len_filter.min_filter_enabled,
    len_filter.min_filter,
    len_filter.max_filter_enabled,
    len_filter.max_filter,
  );
  if (encoded_len == "") {
    params.delete("len");
  } else {
    params.set("len", encoded_len);
  }
  location.hash = "#" + params.toString();

  let new_filter = null;
  min_filter = parseInt(len_filter.min_filter, 10) * 1000;
  max_filter = parseInt(len_filter.max_filter, 10) * 1000;

  let min_filter_expr = [">=", "length_m", min_filter];
  let max_filter_expr = ["<=", "length_m", max_filter];
  if (len_filter.min_filter_enabled && len_filter.max_filter_enabled) {
    new_filter = ["all", min_filter_expr, max_filter_expr];
  } else if (!len_filter.min_filter_enabled && len_filter.max_filter_enabled) {
    new_filter = max_filter_expr;
  } else if (len_filter.min_filter_enabled && !len_filter.max_filter_enabled) {
    new_filter = min_filter_expr;
  } else if (!len_filter.min_filter_enabled && !len_filter.max_filter_enabled) {
    new_filter = null;
  }

  if (map.loaded()) {
    map.setFilter("waterway-line-casing", new_filter);
    map.setFilter("waterway-line", new_filter);
    map.setFilter("waterway-text", new_filter);
  } else {
    map.once("load", () => {
      map.setFilter("waterway-line-casing", new_filter);
      map.setFilter("waterway-line", new_filter);
      map.setFilter("waterway-text", new_filter);
    });
  }
  // need some way to signify the filtering is done...
}

document.addEventListener("DOMContentLoaded", () => {  
  document.querySelector('#shareButton')  
    .addEventListener('click', () => {  
      if (navigator.share) {
        navigator.share({
          title: 'WaterwayMap',
          text: 'WaterwayMap.org - OSM River Basins',
          url: 'http://127.0.0.1/',
        }).then(() => {
          console.log('Thanks for sharing!');
        })
        .catch(console.error);
      } else {
        document.querySelector('#shareDialog').classList.remove('d-none');
      }
  })
});

// example1.addEventListener('click', () => {
//   if (navigator.share) {
//     navigator.share({
//       title: 'MDN',
//       text: 'Learn web development on MDN!',
//       url: 'https://developer.mozilla.org',
//     }).then(() => {
//       console.log('Thanks for sharing!');
//     })
//     .catch(console.error);
//   } else {
//     // shareDialog.classList.add('is-open');
//     console.log('Copy link');
//   }
// });


// let shareData = {
//   title: 'MDN',
//   text: 'Learn web development on MDN!',
//   url: 'https://developer.mozilla.org',
// }

// const shareButton = document.querySelector('shareButton');
// const resultPara = document.querySelector('.result');

// shareButton.addEventListener('click', () => {
//   navigator.share(shareData)
//     .then(() =>
//       resultPara.textContent = 'MDN shared successfully'
//     )
//     .catch((e) =>
//       resultPara.textContent = 'Error: ' + e
//     )
// });
