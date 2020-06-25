import config from '../../../config';

import {createLegendControl} from './legend';

export const MARKER_FILL_COLOR = '#ff7800';
export const MARKER_FILL_OPACITY = 0.8;

/*
 * Create map with base layers, a legend control. The map's initial bounds will be
 * set to extent
 * @param {Array of Number [west, south, east, north]} extent
 * @return {L.map}
 */
export const createSiteMap = function(extent) {
    let gray = new L.layerGroup();
    L.esri.basemapLayer('Gray').addTo(gray);

    if (config.HYDRO_ENDPOINT) {
        gray.addLayer(new L.esri.TiledMapLayer({url: config.HYDRO_ENDPOINT,
            maxZoom: 22,
            maxNativeZoom: 19}));
    }

    // Create map on node
    const map = new L.Map('network-map', {
        center: [0, 0],
        zoom: 1,
        scrollWheelZoom: false,
        layers: gray
    });

    const pExt = JSON.parse(extent);
    const leafletExtent = [[pExt[3],pExt[2]],[pExt[1],pExt[0]]];
    map.fitBounds(leafletExtent);

    map.on('focus', () => {
        map.scrollWheelZoom.enable();
    });
    map.on('blur', () => {
        map.scrollWheelZoom.disable();
    });

    let legendControl = createLegendControl({
        position: 'bottomright'
    });
    legendControl.addTo(map);

    return map;
};

/**
 * Add network layer overlays to a leaflet map. An overlay is added for the sites
 * associated with the network.
 *
 * @param {L.map} map The leaflet map to which the overlay should be added
 * @param networkSites network site geojson data
 */
export const addSitesLayer = function (map, networkSites) {

    const geojsonMarkerOptions = {
        radius: 6,
        fillColor: MARKER_FILL_COLOR,
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: MARKER_FILL_OPACITY
    };

    const onEachPointFeatureAddPopUp = function (feature, layer) {
        const popupText = `Monitoring Location: <a href="${feature.properties.monitoringLocationUrl}">${feature.properties.monitoringLocationName}</a>
            <br>ID: ${feature.properties.monitoringLocationNumber}`;
        layer.bindPopup(popupText);
    };

    const getSitesLayer = function (sites, markerOptions) {
        return L.geoJson(sites, {
            onEachFeature: onEachPointFeatureAddPopUp,
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, markerOptions);
            }
        });
    };

    if(networkSites.length > 0 && networkSites.length < 10000) {
        const sitesLayer = getSitesLayer(networkSites, geojsonMarkerOptions);
        if (networkSites.length > 50) {
            const markers = L.markerClusterGroup({chunkedLoading: true});
            markers.addLayer(sitesLayer);
            map.addLayer(markers);
        } else {
            map.addLayer(sitesLayer);
        }

    } else if (networkSites.length != 0) {
        document.getElementById('overload-map').innerHTML = 'Too many sites to display on map';
    }
};