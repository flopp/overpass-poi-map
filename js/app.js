class App {
    constructor(map_id) {
        this.map = L.map(map_id);
        
        this.layer_pois = null;

        this.layer_openstreetmap = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: 'Map tiles by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
                maxZoom: 16,
                subdomains: 'abc'
        });

        this.map.addLayer(this.layer_openstreetmap);
        this.map.setView(L.latLng(51.246729, 9.254816), 15);

        const self = this;

        $("#btn-location").click(() => { 
            self.locate_me();
        });

        const query = '~"^(shop|tourism|amenity|leisure)$"~"."';

        $("#btn-pois").click(() => {
            self.do_query(query);
        });

        this.do_query(query);
    }

    locate_me() {
        const self = this;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (location) => {
                    self.map.panTo(L.latLng(location.coords.latitude, location.coords.longitude));
                },
                (error) => {
                    console.log(error.message);
                }
            );
        } else {
            console.log("Geolocation services are not available.");
        }
    }

    do_query(query) {
        const self = this;

        if ($("#btn-pois").is('[disabled]')) {
            alert("Already updating POIs...")
            return;
        }

        $("#btn-pois").prop("disabled", true);

        const url = self.build_overpass_url(query);
            
        $.get(url, (osmDataAsJson) => {
            const resultAsGeojson = osmtogeojson(osmDataAsJson);
            if (self.layer_pois !== null) {
                self.map.removeLayer(self.layer_pois);
                self.layer_pois = null;
            }
            self.layer_pois = L.geoJson(resultAsGeojson, {
                style: function (feature) {
                    return {color: "#ff0000"};
                },
                filter: function (feature, layer) {
                    const isPolygon = (feature.geometry) && (feature.geometry.type !== undefined) && (feature.geometry.type === "Polygon");
                    if (isPolygon) {
                        feature.geometry.type = "Point";
                        const polygonCenter = L.latLngBounds(feature.geometry.coordinates[0]).getCenter();
                        feature.geometry.coordinates = [polygonCenter.lat, polygonCenter.lng];
                    }
                    return true;
                },
                onEachFeature: function (feature, layer) {
                    const items = Object.keys(feature.properties).map(k => `<dt>${k}</dt><dd>${feature.properties[k]}</dd>`).join("");
                    layer.bindPopup(`<dl class="properties">${items}</dl>`);
                }
            }).addTo(self.map);
        }).always(() => {
            $("#btn-pois").prop("disabled", false);
        });
    }

    build_overpass_url(query) {
        const map_bounds = this.map.getBounds();
        const bounds = 
            map_bounds.getSouth() + ',' + 
            map_bounds.getWest() + ',' + 
            map_bounds.getNorth() + ',' + 
            map_bounds.getEast();
        const limit = 500;
        const node_query = `node[${query}](${bounds});`;
        const way_query = `way[${query}](${bounds});`;
        const relation_query = `relation[${query}](${bounds});`;
        const query_string = `?data=[out:json][timeout:15];(${node_query}${way_query}${relation_query});out ${limit} body geom;`;
        return `https://overpass-api.de/api/interpreter${query_string}`;
    }
};

$(document).ready(() => {
    window.app = new App('map-container');
});
