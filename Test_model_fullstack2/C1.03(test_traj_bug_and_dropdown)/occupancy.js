async function fetchAccessPoints(building, date, time, granularity = 'minute', level) {
    const url = `http://127.0.0.1:8000/api/v1/building/${building}/datetime/${date}T${time}/access_point/?level=${level}&granularity=${granularity}`;
    //console.log(`Fetching access points with URL: ${url}`); // Added logging
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();
        //console.log('Received access points data:', result);
        return result.data || [];
    } catch (error) {
        console.error('Error fetching access points data:', error);
        return [];
    }
}

async function fetchOccupancyData(date, time, granularity = 'minute') {
    try {
        const url = `http://127.0.0.1:8000/api/v1/campus/datetime/${date}T${time}/?granularity=${granularity}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();
        //console.log('Received occupancy data:', result);
        return result.data || [];
    } catch (error) {
        console.error('Error fetching occupancy data:', error);
        return [];
    }
}

async function fetchBuildingData(building, date, time, granularity = 'minute') {
    const url = `http://127.0.0.1:8000/api/v1/building/${building}/datetime/${date}T${time}/?granularity=${granularity}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();
        //console.log(`Received building data for ${building}:`, result);
        return result.data || [];
    } catch (error) {
        console.error(`Error fetching building data for ${building}:`, error);
        return [];
    }
}

async function fetchTrajectoryData(deviceID) {
    const url = `http://127.0.0.1:8000/api/v1/trajectory/${deviceID}/date/2013-11-29/`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();
        //console.log('Received trajectory data:', result);
        return result.data || null;
    } catch (error) {
        console.error('Error fetching trajectory data:', error);
        return null;
    }
}

function createNumberedMarker(number, lat, lng, popupContent) {
    const markerHtml = `
        <div style="position: relative;">
            <div style="background-color: white; border: 1px solid black; border-radius: 50%; width: 30px; height: 30px; text-align: center; line-height: 30px;">
                ${number}
            </div>
        </div>
    `;
    const markerIcon = L.divIcon({
        html: markerHtml,
        className: 'numbered-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    return L.marker([lat, lng], { icon: markerIcon }).bindPopup(popupContent);
}

// New function to clean time format
function cleanTimeFormat(time) {
    return time.replace(/(am|pm)/i, '').trim();
}

// trajectory helper function
function addRoute(map, waypoints) {
    // Convert waypoints to LatLng objects
    var latLngWaypoints = waypoints.map(function(point) {
        return L.latLng(point[0], point[1]);
    });

    L.Routing.control({
        waypoints: latLngWaypoints,
        router: L.Routing.osrmv1({
            profile: 'foot' // Specify the walking profile
        }),
        lineOptions: {
            styles: [{ color: 'blue', opacity: 0.6, weight: 4 }]
        },
        show: false // Hide the instructions sidebar
    }).addTo(map);
}

// This function plots a user's trajectory given a device ID
async function plotRouteWithOccupancyAndHeatmap(deviceID) {
    const trajectoryData = await fetchTrajectoryData(deviceID);
    if (!trajectoryData) {
        alert('Invalid ID');
        return;
    }

    const mapCenter = [42.392, -72.527];
    map.setView(mapCenter, 17);

    let heatmapData = [];
    let placesVisited = [];
    let visitTimes = {};

    const coordinates = trajectoryData[0].map(segment => [segment.building_lat, segment.building_long]);
    //console.log(coordinates);
    const startSegment = trajectoryData[0][0];
    const endSegment = trajectoryData[0][trajectoryData[0].length - 1];
    const dateForOccupancy = getDateInput();

    for (let i = 0; i < coordinates.length; i++) {
        const segment = trajectoryData[0][i];
        const time = cleanTimeFormat(segment.start_time); // Clean the time format here
        const building = segment.building;
        const occupancyData = await fetchBuildingData(building, dateForOccupancy, time);
        const occupancyInfo = occupancyData.prediction !== undefined ? occupancyData.prediction : occupancyData.connection_count !== undefined ? occupancyData.connection_count : 'N/A';

        if (occupancyData.prediction !== undefined || occupancyData.connection_count !== undefined) {
            heatmapData.push([segment.building_lat, segment.building_long, (occupancyData.prediction || occupancyData.connection_count) * 10]);
        }

        if (!visitTimes[segment.building]) {
            visitTimes[segment.building] = [];
        }
        visitTimes[segment.building].push(`${segment.start_time} - ${segment.end_time} (Occupancy: ${occupancyInfo})`);

        placesVisited.push(`${segment.building} (${segment.start_time} - ${segment.end_time})`);
    }

    let markerCount = 1;
    for (const [building, times] of Object.entries(visitTimes)) {
        const latLng = coordinates[placesVisited.findIndex(place => place.includes(building))];
        const popupContent = `${building}<br>${times.join('<br>')}`;
        createNumberedMarker(markerCount++, latLng[0], latLng[1], popupContent).addTo(map);
    }

    // Use the addRoute function to plot the route with roads
    addRoute(map, coordinates);

    L.circleMarker([startSegment.building_lat, startSegment.building_long], {
        color: 'green',
        radius: 10
    }).addTo(map).bindPopup(`Start: ${startSegment.building}<br>${startSegment.start_time}`);

    L.circleMarker([endSegment.building_lat, endSegment.building_long], {
        color: 'red',
        radius: 10
    }).addTo(map).bindPopup(`End: ${endSegment.building}<br>${endSegment.end_time}`);

    const statsBox = document.getElementById('stats-box');
    statsBox.innerHTML = `
        <h3>Route Details</h3>
        <p><strong>Start Time:</strong> ${startSegment.start_time}</p>
        <p><strong>End Time:</strong> ${endSegment.end_time}</p>
        <p><strong>Places Visited:</strong></p>
        <ul>
            ${placesVisited.map(place => `<li>${place}</li>`).join('')}
        </ul>
    `;

    heat.setLatLngs(heatmapData);

    const startTime = parseInt(startSegment.start_time.split(':').reduce((acc, time) => (60 * acc) + +time));
    const endTime = parseInt(endSegment.end_time.split(':').reduce((acc, time) => (60 * acc) + +time));

    const timebar = document.getElementById('timebar');
    timebar.min = startTime;
    timebar.max = endTime;
    timebar.value = startTime;

    timebar.addEventListener('input', async () => {
        const currentTime = parseInt(timebar.value, 10);
        const formattedTime = formatTime(currentTime);
        const occupancyData = await fetchOccupancyData(dateForOccupancy, formattedTime, 'minute');
        const filteredData = occupancyData
            .filter(entry => entry.prediction !== undefined || entry.connection_count !== undefined)
            .map(entry => [entry.building_lat, entry.building_long, (entry.prediction || entry.connection_count)]);

        heat.setLatLngs(filteredData);
    });

    document.getElementById('start-button').addEventListener('click', () => {
        let intervalId = setInterval(() => {
            timebar.value = parseInt(timebar.value, 10) + 1;
            if (timebar.value > endTime) {
                clearInterval(intervalId);
            } else {
                timebar.dispatchEvent(new Event('input'));
            }
        }, 1000);
    });

    document.getElementById('stop-button').addEventListener('click', () => {
        clearInterval(intervalId);
    });
}


window.onload = init;

let heat;
let map;
let intervalId = null;
let selectedBuilding = null;
let buildings = [];
let buildingLayers = [];
let viewByHour = false;
let lastSelectedMinute = 0;
let lastSelectedHour = 0;
let selectedFloor = null;
let accessPoints = [];
let accessPointLayers = [];
let isTrajectoryView = false;

function init() {
    map = L.map('mapid').setView([42.392, -72.527], 17);

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> contributors',
        maxZoom: 22,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'replace_with_your_acces_token'
    }).addTo(map);

    heat = L.heatLayer([], {
        radius: 30,
        blur: 20,
        maxZoom: 22,
        maxOpacity: 0.9,
        gradient: {
            0.1: 'indigo',
            0.3: 'blue',
            0.5: 'yellow',
            0.7: 'orange',
            1.0: 'red'
        }
    }).addTo(map);

    const timebar = document.getElementById('timebar');
    timebar.addEventListener('input', debounce(updateHeatmapData, 300));
    timebar.addEventListener('change', () => {
        if (selectedBuilding) {
            const time = viewByHour ? parseInt(timebar.value) * 60 : timebar.value;
            updateBuildingStats(selectedBuilding.name, getDateInput(), time);
        }
    });

    document.getElementById('start-button').addEventListener('click', startAnimation);
    document.getElementById('stop-button').addEventListener('click', stopAnimation);
    document.getElementById('toggle-view-button').addEventListener('click', toggleViewMode);
    document.getElementById('view-occupancy-button').addEventListener('click', handleDateInput);
    document.getElementById('view-trajectory-button').addEventListener('click', () => {
        const deviceID = document.getElementById('device-id-input').value;
        plotRouteWithOccupancyAndHeatmap(deviceID);
    });

    initializeBuildings();

    setInterval(updateHeatmapData, 10000);
}

function toggleViewMode() {
    viewByHour = !viewByHour;
    const toggleButton = document.getElementById('toggle-view-button');
    const timebar = document.getElementById('timebar');

    if (viewByHour) {
        lastSelectedMinute = parseInt(timebar.value, 10);
        toggleButton.innerText = 'View by Minute';
        timebar.max = 23;
        timebar.value = Math.floor(lastSelectedMinute / 60);
    } else {
        lastSelectedHour = parseInt(timebar.value, 10);
        toggleButton.innerText = 'View by Hour';
        timebar.max = 1439;
        timebar.value = lastSelectedHour * 60 + (lastSelectedMinute % 60);
    }
    updateHeatmapData(getDateInput());
}

async function initializeBuildings() {
    const date = getDateInput();
    const time = '13:00';
    const occupancyData = await fetchOccupancyData(date, time);

    if (occupancyData) {
        //console.log('Initializing buildings...');
        buildings = occupancyData.map(entry => ({
            name: entry.building,
            lat: entry.building_lat,
            long: entry.building_long
        }));
        createBuildingButtons(buildings);
        addBuildingLayers(buildings);
        updateHeatmapData(date);
    }
}

function createBuildingButtons(buildings) {
    const container = document.getElementById('building-buttons-container');
    container.innerHTML = '';

    const campusButton = document.createElement('button');
    campusButton.className = 'building-button';
    campusButton.innerText = 'Campus';
    campusButton.setAttribute('data-building', 'campus');
    campusButton.addEventListener('click', () => {
        selectedBuilding = null;
        selectedFloor = null;
        map.setView([42.392, -72.527], 17);
        updateHeatmapData(getDateInput());
        clearBuildingStats();
        clearFloorButtons();
        clearAccessPoints(); // Remove access points when "Campus" is clicked
    });
    container.appendChild(campusButton);
}

function addBuildingLayers(buildings) {
    buildings.forEach(building => {
        const layer = L.circle([building.lat, building.long], {
            color: 'transparent',
            fillColor: 'transparent',
            fillOpacity: 0,
            radius: 50
        }).addTo(map);

        layer.on('mouseover', () => {
            layer.setStyle({
                color: 'white',
                fillColor: 'white',
                fillOpacity: 0.3
            });
            layer.bindTooltip(building.name, {
                permanent: false,
                direction: 'top',
                offset: L.point(0, -10)
            }).openTooltip();           
        });

        layer.on('mouseout', () => {
            layer.setStyle({
                color: 'transparent',
                fillColor: 'transparent',
                fillOpacity: 0
            });
            layer.unbindTooltip();
        });

        layer.on('click', async () => {
            map.setView([building.lat, building.long], 19);
            selectedBuilding = building;
            selectedFloor = 1; // Reset the selected floor
            const time = viewByHour ? parseInt(document.getElementById('timebar').value) * 60 : document.getElementById('timebar').value;
            await initializeAccessPointsAndUpdateHeatmap(building.name, getDateInput(), formatTime(time));
            await updateHeatmapData(getDateInput());
            await updateBuildingStats(building.name, getDateInput(), formatTime(time));
        });

        buildingLayers.push(layer);
    });
}

async function initializeAccessPointsAndUpdateHeatmap(building, date, time) {
    //console.log(`Initializing access points for building: ${building}, date: ${date}, time: ${time}, level: ${selectedFloor}`); // Added logging
    accessPoints = await fetchAccessPoints(building, date, time, 'minute', selectedFloor);
    if (Array.isArray(accessPoints) && accessPoints.length > 0) {
        //console.log('Access Points:', accessPoints);
        updateAccessPoints();
        updateHeatmapData(date); // Call heatmap update after access points are updated
    } else {
        //console.log('No access points data received.');
        accessPoints = []; // Ensure accessPoints is an array
        updateHeatmapData(date); // Ensure heatmap update is called even if no access points are received
    }
}

function updateAccessPoints() {
    //console.log('Updating access points on the map.');
    if (!selectedFloor) {
        return;
    }

    clearAccessPoints(); // Clear existing access points
    if (Array.isArray(accessPoints) && accessPoints.length > 0) {
        plotAccessPoints(map, accessPoints);
    }
}

function clearAccessPoints() {
    accessPointLayers.forEach(layer => {
        map.removeLayer(layer);
    });
    accessPointLayers = [];
}

async function updateHeatmapData(date = '2021-03-01') {
    const timebar = document.getElementById('timebar');
    const timeDisplay = document.getElementById('time-display');
    let selectedMinutes = parseInt(timebar.value, 10);
    let selectedHour = Math.floor(selectedMinutes / 60);
    let selectedMinute = selectedMinutes % 60;
    let timeString = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}:00`;

    if (viewByHour) {
        selectedHour = selectedMinutes;
        selectedMinute = 0;
        selectedMinutes = selectedHour * 60;
        timeString = `${String(selectedHour).padStart(2, '0')}:00:00`;
    }

    timeDisplay.innerText = timeString;

    const formattedTime = formatTime(selectedMinutes);

    const occupancyData = await fetchOccupancyData(date, formattedTime, viewByHour ? 'hour' : 'minute');
    if (!occupancyData) return;

    let filteredData = [];
    let totalCount = 0;

    if (selectedBuilding) {
        const buildingData = await fetchBuildingData(selectedBuilding.name, date, formattedTime, viewByHour ? 'hour' : 'minute');
        if (buildingData) {
            if (viewByHour) {
                // Hourly view
                filteredData = [[buildingData.building_lat, buildingData.building_long, buildingData.connection_count]];
                totalCount = buildingData.connection_count;
            } else {
                // Minute view
                filteredData = [[buildingData.building_lat, buildingData.building_long, buildingData.connection_count]];
                totalCount = buildingData.connection_count;
            }
        } else {
            console.error(`No data found for selected building: ${selectedBuilding.name}`);
        }
    } else {
        filteredData = occupancyData
            .filter(entry => entry.connection_count !== undefined)
            .map(entry => [entry.building_lat, entry.building_long, entry.connection_count]);
        totalCount = filteredData.reduce((acc, entry) => acc + entry[2], 0);
    }

    if (selectedFloor && selectedBuilding && Array.isArray(accessPoints) && accessPoints.length > 0) {
        const accessPointData = accessPoints.map(ap => [ap.building_lat, ap.building_long, ap.connection_count, 'access_point']); // Add the 'access_point' identifier
        if (accessPointData.length > 0) {
            filteredData = accessPointData;
        }
    }

    //console.log('Filtered data for heatmap:', filteredData); // Added logging

    if (map.getZoom() > 18) {
        updateHeatmapAtBuildingLevel(filteredData);
    } else {
        updateHeatmap(filteredData);
    }

    const counter = document.getElementById('occupancy-counter');
    if (!viewByHour) {
        counter.innerText = selectedBuilding
            ? `${selectedBuilding.name} current occupancy: ${totalCount}`
            : `Campus current occupancy: ${totalCount}`;
    } else if (!selectedBuilding) {
        counter.innerText = `Campus current occupancy: ${totalCount}`;
    } else {
        counter.innerText = '';
    }

    if (selectedBuilding) {
        const time = viewByHour ? selectedHour * 60 : selectedMinutes;
        await updateBuildingStats(selectedBuilding.name, date, formatTime(time));
    }
}

async function updateBuildingStats(building, date, time) {
    const buildingData = await fetchBuildingData(building, date, time, viewByHour ? 'hour' : 'minute');
    if (!buildingData) return;

    let statsContainer = document.getElementById('building-stats-container');
    if (!statsContainer) {
        statsContainer = document.createElement('div');
        statsContainer.id = 'building-stats-container';
        statsContainer.style.position = 'absolute';
        statsContainer.style.right = '10px';
        statsContainer.style.top = '50px';
        statsContainer.style.zIndex = '1000';
        statsContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        statsContainer.style.padding = '10px';
        statsContainer.style.borderRadius = '5px';
        document.body.appendChild(statsContainer);
    }

    if (viewByHour) {
        statsContainer.innerHTML = `
            <strong>${building} Stats:</strong>
            <br>Hourly Occupancy: ${buildingData.connection_count}
            <br>Avg Stay: ${buildingData.average} min
            <br>Std Dev: ${buildingData.standard_deviation} min
            <br>Floors: ${buildingData.no_floors}
        `;
    } else {
        statsContainer.innerHTML = `
            <strong>${building} Stats:</strong>
            <br>Current Occupancy: ${buildingData.connection_count}
        `;
    }
    
    createFloorButtons(buildingData.no_floors);
}

function clearBuildingStats() {
    const statsContainer = document.getElementById('building-stats-container');
    if (statsContainer) {
        statsContainer.innerHTML = '';
    }
}

function updateHeatmap(data) {
    //console.log('Updating heatmap with data:', data); // Log data for debugging
    const enhancedData = data.map(point => [point[0], point[1], point[2] / 1.5]);
    heat.setLatLngs(enhancedData);
}

function updateHeatmapAtBuildingLevel(data) {
    //console.log('Original data:', data);

    // Filter to include only access point data
    const accessPointData = data.filter(point => point[3] && point[3] === 'access_point');

    //console.log('Access point data:', accessPointData);

    if (accessPointData.length > 0) {
        // Adjust the intensity for access points
        const accessPointHeatData = accessPointData.map(point => [point[0], point[1], point[2] / 0.5]);
        //console.log('Enhanced data for heatmap (access points):', accessPointHeatData);
        heat.setLatLngs(accessPointHeatData);
    } else {
        // If no access point data, keep the original data
        const otherData = data.filter(point => !point[3] || point[3] !== 'access_point');
        const enhancedData = otherData.map(point => [point[0], point[1], point[2] / 6.5]);
        //console.log('Enhanced data for heatmap (no access points):', enhancedData);
        heat.setLatLngs(enhancedData);
    }
}

function plotAccessPoints(map, accessPoints) {
    accessPoints.forEach(ap => {
        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="text-align:center;color:black;font-weight:bold;">${ap.access_point}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const layer = L.marker([ap.building_lat, ap.building_long], { icon: icon }).addTo(map).bindPopup(`Access Point: ${ap.access_point}`);
        accessPointLayers.push(layer);
    });
}

function createFloorButtons(noFloors) {
    //console.log('Creating floor buttons:', noFloors); // Debugging information
    const floorContainer = document.getElementById('floor-buttons-container');
    
    if (!floorContainer) {
        console.error('Floor buttons container not found.');
        return;
    }

    floorContainer.innerHTML = ''; // Clear existing buttons

    for (let floor = 1; floor <= noFloors; floor++) {
        const floorButton = document.createElement('button');
        floorButton.className = 'floor-button';
        floorButton.innerText = `Floor ${floor}`;
        floorButton.setAttribute('data-floor', floor);
        floorButton.addEventListener('click', async () => {
            selectedFloor = floor;
            //console.log(`Floor ${floor} button clicked`); // Debugging information
            const date = getDateInput();
            const time = viewByHour ? parseInt(document.getElementById('timebar').value) * 60 : document.getElementById('timebar').value;
            await initializeAccessPointsAndUpdateHeatmap(selectedBuilding.name, date, formatTime(time));
        });
        floorContainer.appendChild(floorButton);
    }

    //console.log('Floor buttons created'); // Debugging information
}

function clearFloorButtons() {
    const floorContainer = document.getElementById('floor-buttons-container');
    if (floorContainer) {
        floorContainer.innerHTML = ''; // Clear floor buttons
    }
}

function startAnimation() {
    if (intervalId) return;

    intervalId = setInterval(() => {
        const timebar = document.getElementById('timebar');
        timebar.value = viewByHour ? (parseInt(timebar.value, 10) + 1) % 24 : (parseInt(timebar.value, 10) + 1) % 1440;
        updateHeatmapData(getDateInput());
    }, 1000);
}

function stopAnimation() {
    clearInterval(intervalId);
    intervalId = null;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function formatTime(minutes) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mins = String(minutes % 60).padStart(2, '0');
    return `${hours}:${mins}`;
}

function handleDateInput() {
    const dateInput = document.getElementById('date-input').value;
    if (isValidDate(dateInput)) {
        updateHeatmapData(dateInput);
    } else {
        alert('Invalid date format. Using default date: 2021-03-01.');
        updateHeatmapData('2021-03-01');
    }
}

function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(regex)) return false;

    const date = new Date(dateString);
    const timestamp = date.getTime();

    if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) return false;
    return date.toISOString().startsWith(dateString);
}

function getDateInput() {
    const dateInput = document.getElementById('date-input').value;
    return isValidDate(dateInput) ? dateInput : '2021-03-01';
}
