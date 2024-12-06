import Maps from './scripts/maps.js';

fetch('https://raw.githubusercontent.com/lecardot/earthTravel/main/docs/assets/parameters.json')
    .then(res => res.json())
    .then(params => {

        var projection = d3.geoOrthographic()
            .scale(params.earth.size.radius)
            .rotate(params.earth.initRotation)
            .translate([params.offset.X, params.offset.Y])
            .clipAngle(90);

        var skyProjection = d3.geoOrthographic()
            .scale(params.earth.size.radius + params.flyer.altitude)
            .rotate(params.earth.initRotation)
            .translate([params.offset.X, params.offset.Y])
            .clipAngle(90);

        var swoosh = d3.line()
            .x(function (d) { return d[0] })
            .y(function (d) { return d[1] })
            .curve(d3.curveBasis);

        var graticule = d3.geoGraticule();

        var svg_w = d3.select("svg#world")
            .call(
                d3.drag()
                    .subject(function () {
                        var r = projection.rotate();
                        return { x: r[0] / params.sensitivity, y: -r[1] / params.sensitivity };
                    })
                    .on("drag", dragged)
            )
            .call(
                d3.zoom()
                    .scaleExtent(params.earth.scaleExtent)
                    .on("zoom", x => zoomed(svg_w, x))
            );


        const proj_f = d3.geoConicConformal()
            .center([2.454071, 46.279229])
            .scale(2800)

        const france = new Maps(d3.select("svg#france"));
        france.addProjection(proj_f)
            .addPath(d3.geoPath())
            .addHistoricData(params.visitedDepartements, params.livedDepartements);

        const proj_c = d3.geoMercator()
            .scale(450)
            .rotate([96, -64.15]);

        const canada = new Maps(d3.select("svg#canada"));
        canada.addProjection(proj_c)
            .addPath(d3.geoPath())
            .addHistoricData(params.visitedProvs, params.livedProvs);

        const world = new Maps(svg_w);
        world.addProjection(projection)
            .addPath(d3.geoPath())
            .addHistoricData(params.visitedCountries, params.livedCountries);

        const path = world.path.pointRadius(1.5);

        d3.queue()
            .defer(d3.json, "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson")
            .defer(d3.json, "https://raw.githubusercontent.com/wisdomtheif/Canadian_GeoJSON/master/canada_provinces.geojson")
            .defer(d3.json, "https://raw.githubusercontent.com/d3/d3.github.com/master/world-110m.v1.json")
            .defer(d3.json, "https://raw.githubusercontent.com/lecardot/earthTravel/main/docs/assets/data/places.json")
            .defer(d3.json, "https://raw.githubusercontent.com/lecardot/earthTravel/main/docs/assets/data/links.json")
            .await(ready);

        function ready(error, data_france, data_canada, data_world, places, links) {

            france.addData(data_france.features);
            france.drawData()
            france.drawPoints("france", places.features, 3.5);

            canada.addData(data_canada.features);
            canada.drawData()
            canada.drawPoints("canada", places.features, 2.5);

            world.addData(topojson.feature(data_world, data_world.objects.countries).features);

            svg_w.append("ellipse")
                .attr("cx", params.offset.X - 40)
                .attr("cy", params.offset.Y + params.earth.size.radius - 20)
                .attr("rx", projection.scale() * 0.9)
                .attr("ry", projection.scale() * 0.25)
                .attr("class", "noclicks")
                .style("fill", "url(#drop_shadow)");

            svg_w.append("circle")
                .attr("cx", params.offset.X)
                .attr("cy", params.offset.Y)
                .attr("r", projection.scale())
                .attr("class", "noclicks")
                .style("fill", "url(#ocean_fill)");

            svg_w.append("path")
                .datum(topojson.feature(data_world, data_world.objects.land))
                .attr("class", "land")
                .attr("d", path);

            svg_w.append("path")
                .datum(graticule)
                .attr("class", "graticule noclicks")
                .attr("d", path);

            svg_w.append("circle")
                .attr("cx", params.offset.X)
                .attr("cy", params.offset.Y)
                .attr("r", projection.scale())
                .attr("class", "noclicks")
                .style("fill", "url(#globe_highlight)");

            svg_w.append("circle")
                .attr("cx", params.offset.X)
                .attr("cy", params.offset.Y)
                .attr("r", projection.scale())
                .attr("class", "noclicks")
                .style("fill", "url(#globe_shading)");


            let strip = "linear-gradient(103deg, #F6F0CF 25%, #fff 25%, #fff 50%, #F6F0CF 50%, #F6F0CF 75%, #fff 75%, #fff 100%)"

            svg_w.append("g")
                .attr("class", "countries")
                .selectAll("path")
                .data(topojson.feature(data_world, data_world.objects.countries).features)
                .enter()
                .append("path")
                .attr("id", p => "c" + p.id)
                .attr("d", path)
                .style("fill", p => params.visitedCountries.includes(p.id) ? "var(--visited-color)" : params.livedCountries.includes(p.id) ? "var(--lived-color)" : "var(--rest-color)")

            svg_w.append("g")
                .attr("class", "points")
                .selectAll(".point")
                .data(places.features)
                .enter()
                .filter(d => d.properties.note.includes("world"))
                .append("path")
                .attr("id", d => "pw" + d.properties.name)
                .attr("class", "point")
                .attr("d", path);

            svg_w.append("g")
                .attr("class", "labels")
                .selectAll(".label")
                .data(places.features)
                .enter()
                .filter(d => d.properties.note.includes("world"))
                .append("text")
                .attr("class", "label")
                .attr("id", d => "l" + d.properties.name)
                .style("font-weight", 300)
                .text(d => d.properties.name);

            position_labels();

            svg_w.append("g").attr("class", "arcs")
                .selectAll("path").data(links.features)
                .enter().append("path")
                .attr("class", "arc")
                .attr("d", path)
                .attr("opacity", function (d) {
                    return fade_at_edge(d)
                });

            svg_w.append("g").attr("class", "flyers")
                .selectAll("path").data(links.features)
                .enter().append("path")
                .attr("class", "flyer")
                .attr("id", d => "f" + d.properties.sourcename + d.properties.targetname)
                .attr("d", function (d) { return swoosh(flying_arc(d)) })
                .attr("opacity", function (d) {
                    return fade_at_edge(d)
                }).on("mouseover", (d) => {

                    d3.selectAll("svg#world.point")
                        .style("visibility", "hidden")

                    d3.selectAll(".flyer")
                        .style("stroke-width", 1)

                    d3.selectAll(".label")
                        .style("visibility", "hidden")
                        .style("font-size", 3)

                    d3.selectAll("#f" + d.properties.sourcename + d.properties.targetname)
                        .style("stroke-width", 3)
                        .style("stroke", d => d.properties.transport === "plane" ? "blue" : "green") // selon params

                    d3.selectAll("#pw" + d.properties.sourcename)
                        .style("visibility", "visible")
                        .style("fill", 'blue')  // selon params
                    d3.selectAll("#pw" + d.properties.targetname)
                        .style("visibility", "visible")
                        .style("fill", 'blue') // selon params

                    d3.selectAll("#l" + d.properties.sourcename)
                        .style("visibility", "visible")
                        .style("font-size", 10)
                        .style("font-weight", 900)
                    d3.selectAll("#l" + d.properties.targetname)
                        .style("visibility", "visible")
                        .style("font-size", 10)
                        .style("font-weight", 900)

                }).on("mouseout", (d) => {

                    d3.selectAll(".flyer")
                        .style("stroke-width", 2)
                        .style("stroke", null)

                    d3.selectAll(".label")
                        .style("visibility", "visible")
                        .style("font-size", 6)

                    d3.selectAll("#pw" + d.properties.sourcename)
                        .style("fill", null)   // selon params
                    d3.selectAll("#pw" + d.properties.targetname)
                        .style("fill", null)   // selon params

                    d3.selectAll("#l" + d.properties.sourcename)
                        .style("font-size", 6)
                        .style("font-weight", 300)
                    d3.selectAll("#l" + d.properties.targetname)
                        .style("font-size", 6)
                        .style("font-weight", 300)

                });
        }

        function position_labels() {
            var centerPos = projection.invert([params.offset.X, params.offset.Y]);

            svg_w.selectAll(".label")
                .attr("text-anchor", function (d) {
                    var x = projection(d.geometry.coordinates)[0];
                    return x < params.offset.X - 20 ? "end" : x < params.offset.X + 20 ? "middle" : "start";
                })
                .attr("transform", function (d) {
                    var loc = projection(d.geometry.coordinates),
                        x = loc[0],
                        y = loc[1];
                    var offset = x < params.offset.X ? -5 : 5;
                    return "translate(" + (x + offset) + "," + (y - 2) + ")";
                })
                .style("display", function (d) {
                    var d = d3.geoDistance(d.geometry.coordinates, centerPos);
                    return d > 1.57 ? "none" : "inline";
                });
        }

        function flying_arc(pts) {
            var source = pts.geometry.coordinates[0],
                target = pts.geometry.coordinates[1];

            var mid1 = location_along_arc(source, target, .333);
            var mid2 = location_along_arc(source, target, .667);
            var result = [projection(source),
            skyProjection(mid1),
            skyProjection(mid2),
            projection(target)]

            // console.log(result);
            return result;
        }

        function fade_at_edge(d) {
            var centerPos = projection.invert([params.offset.X, params.offset.Y]);

            let start = d.geometry.coordinates[0],
                end = d.geometry.coordinates[1];

            var start_dist = 1.57 - d3.geoDistance(start, centerPos),
                end_dist = 1.57 - d3.geoDistance(end, centerPos);

            var fade = d3.scaleLinear().domain([-.1, 0]).range([0, .1])
            var dist = start_dist < end_dist ? start_dist : end_dist;

            return fade(dist)
        }

        function location_along_arc(start, end, loc) {
            var interpolator = d3.geoInterpolate(start, end);
            return interpolator(loc)
        }

        function dragged() {
            var o1 = [d3.event.x * params.sensitivity, -d3.event.y * params.sensitivity];
            o1[1] =
                o1[1] > params.earth.maxElevation
                    ? params.earth.maxElevation
                    : o1[1] < -params.earth.maxElevation
                        ? -params.earth.maxElevation
                        : o1[1];
            projection.rotate(o1);
            skyProjection.rotate(o1);
            refresh();
        }

        function zoomed(svg) {
            if (d3.event) {
                svg.transition().duration(100).attr("transform", "scale(" + d3.event.transform.k + ")");
            }
        }

        function refresh() {
            svg_w.selectAll(".land").attr("d", path);
            svg_w.selectAll(".countries path").attr("d", path);
            svg_w.selectAll(".graticule").attr("d", path);
            refreshLandmarks();
            refreshFlyers();
        }

        function refreshLandmarks() {
            svg_w.selectAll(".point").attr("d", path);
            position_labels();
        }

        function refreshFlyers() {
            svg_w.selectAll(".arc").attr("d", path)
                .attr("opacity", function (d) {
                    return fade_at_edge(d)
                });

            svg_w.selectAll(".flyer")
                .attr("d", function (d) { return swoosh(flying_arc(d)) })
                .attr("opacity", function (d) {
                    return fade_at_edge(d)
                });
        }

    })