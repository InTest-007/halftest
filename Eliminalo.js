// innacri.js - Sistema completo de alertas ciudadanas

const CRIME_TYPES = [
    { id: 'robo', name: 'Robo', color: '#f59e0b', icon: '💰' },
    { id: 'asalto', name: 'Asalto', color: '#ef4444', icon: '🔪' },
    { id: 'estafa', name: 'Estafa', color: '#8b5cf6', icon: '📱' },
    { id: 'vandalismo', name: 'Vandalismo', color: '#6366f1', icon: '🔨' },
    { id: 'secuestro', name: 'Secuestro', color: '#dc2626', icon: '🚨' },
    { id: 'extorsion', name: 'Extorsión', color: '#7c3aed', icon: '📞' }
];

const SEVERITY_LEVELS = [
    { id: 1, name: 'Bajo', color: '#10b981' },
    { id: 2, name: 'Moderado', color: '#f59e0b' },
    { id: 3, name: 'Alto', color: '#ef4444' },
    { id: 4, name: 'Crítico', color: '#dc2626' },
    { id: 5, name: 'Emergencia', color: '#991b1b' }
];

const ZONAS = [
    'Zona 1', 'Zona 2', 'Zona 3', 'Zona 4', 'Zona 5', 'Zona 6',
    'Zona 7', 'Zona 8', 'Zona 9', 'Zona 10', 'Zona 11', 'Zona 12',
    'Zona 13', 'Zona 14', 'Zona 15', 'Zona 16', 'Zona 17', 'Zona 18',
    'Zona 19', 'Zona 21', 'Zona 24', 'Zona 25'
];

let map;
let locationPickerMap;
let markers = [];
let alerts = [];
let filters = { types: [], severity: [] };
let selectedCrimeType = '';
let heatLayer;
let selectedLocation = { lat: 14.6349, lng: -90.5069 };
let notificationsEnabled = false;
let filtersMinimized = false;
let userLocation = { lat: 14.6349, lng: -90.5069 };
let proximityCheckInterval = null;
let PROXIMITY_RADIUS_KM = 0.5; // Radio de proximidad en km

// ============================================
// INICIALIZACIÓN DEL MAPA PRINCIPAL
// ============================================
function initMap() {
    map = L.map('map').setView([14.6349, -90.5069], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    syncAlerts();
    updateMap();
    startProximityDetection();
    getUserLocationContinuous();
}

// ============================================
// LOCATION PICKER (Selector de Ubicación)
// ============================================
function initLocationPicker() {
    if (locationPickerMap) {
        locationPickerMap.remove();
    }

    locationPickerMap = L.map('locationPicker').setView([selectedLocation.lat, selectedLocation.lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(locationPickerMap);

    locationPickerMap.on('moveend', function() {
        const center = locationPickerMap.getCenter();
        selectedLocation = { lat: center.lat, lng: center.lng };
        updateLocationInfo();
    });

    locationPickerMap.on('move', function() {
        const center = locationPickerMap.getCenter();
        selectedLocation = { lat: center.lat, lng: center.lng };
    });

    setTimeout(() => locationPickerMap.invalidateSize(), 100);
}

function updateLocationInfo() {
    document.getElementById('locationCoords').textContent = 
        'Lat: ' + selectedLocation.lat.toFixed(6) + ', Lng: ' + selectedLocation.lng.toFixed(6);
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                selectedLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                if (locationPickerMap) {
                    locationPickerMap.setView([selectedLocation.lat, selectedLocation.lng], 15);
                }
                updateLocationInfo();
                alert('📍 Ubicación actual obtenida correctamente');
            },
            function(error) {
                alert('No se pudo obtener tu ubicación. Usa el mapa para seleccionar manualmente.');
            }
        );
    } else {
        alert('Tu navegador no soporta geolocalización');
    }
}

// ============================================
// SINCRONIZACIÓN DE ALERTAS CON LOCALSTORAGE
// ============================================
function saveAlertsToStorage() {
    localStorage.setItem('innacri_alerts', JSON.stringify(alerts));
}

function loadAlertsFromStorage() {
    const stored = localStorage.getItem('innacri_alerts');
    if (stored) {
        alerts = JSON.parse(stored);
        return true;
    }
    return false;
}

function syncAlerts() {
    // Cargar alertas del almacenamiento
    if (!loadAlertsFromStorage()) {
        // Si no hay alertas almacenadas, generar de ejemplo
        generateSampleAlerts();
    }
    updateStats();
    updateMap();
}

// ============================================
// DETECCIÓN DE ALERTAS POR PROXIMIDAD
// ============================================
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function checkProximityAlerts() {
    const proximityAlerts = alerts.filter(alert => {
        if (alert.status !== 'approved') return false;
        const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            alert.lat, alert.lng
        );
        return distance <= PROXIMITY_RADIUS_KM;
    });

    if (proximityAlerts.length > 0) {
        const alert = proximityAlerts[0];
        showProximityNotification(alert);
    }
}

function showProximityNotification(alert, distance = null) {
    const displayDistance = distance ? `${(distance * 1000).toFixed(0)}m` : `menos de ${PROXIMITY_RADIUS_KM}km`;
    
    const notification = document.createElement('div');
    notification.className = 'push-notification show';
    notification.innerHTML = `
        <div class="notif-header">
            <div class="notif-title">
                ⚠️ ALERTA CERCANA
            </div>
            <button class="notif-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="notif-body">
            <strong>${alert.typeIcon} ${alert.typeName}</strong><br>
            Ubicación: ${alert.zona}<br>
            Severidad: <span style="color: ${alert.severityColor}; font-weight: bold;">${alert.severityName}</span>
        </div>
        <div class="notif-meta">
            📍 A ${displayDistance} de tu ubicación
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentElement) notification.remove();
    }, 5000);
}

let simulationActive = false;
let lastSimulationIndex = 0;

function startNotificationSimulation() {
    const notifToggle = document.getElementById('notifToggle');
    
    if (simulationActive) {
        simulationActive = false;
        notifToggle.style.opacity = '1';
        console.log('❌ Simulación detenida');
        return;
    }
    
    simulationActive = true;
    notifToggle.style.opacity = '0.5';
    console.log('🔔 Simulación iniciada - Notificación cada 30 segundos');
    
    const simulateNotification = () => {
        if (!simulationActive || alerts.length === 0) return;
        
        const approvedAlerts = alerts.filter(a => a.status === 'approved');
        if (approvedAlerts.length === 0) {
            if (simulationActive) setTimeout(simulateNotification, 30000);
            return;
        }
        
        const alert = approvedAlerts[lastSimulationIndex % approvedAlerts.length];
        const randomDistance = (Math.random() * 0.5).toFixed(3);
        showProximityNotification(alert, parseFloat(randomDistance));
        lastSimulationIndex++;
        
        if (simulationActive) {
            setTimeout(simulateNotification, 30000);
        }
    };
    
    simulateNotification();
}

// Demo de notificación de proximidad (para testing)
function demoProximityNotification() {
    const demoAlert = {
        typeIcon: '💰',
        typeName: 'Robo',
        zona: 'Zona 5 - Centro Cívico',
        severityColor: '#ef4444',
        severityName: 'Alto'
    };
    showProximityNotification(demoAlert);
}

function startProximityDetection() {
    proximityCheckInterval = setInterval(() => {
        if (notificationsEnabled) {
            checkProximityAlerts();
        }
    }, 10000); // Revisar cada 10 segundos
}

// ============================================
// LOCALIZACIÓN DEL USUARIO
// ============================================
function getUserLocationContinuous() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            function(position) {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
            },
            function(error) {
                console.log('Geolocalización deshabilitada');
            },
            { enableHighAccuracy: false, maximumAge: 30000 }
        );
    }
}
function generateSampleAlerts() {
    alerts = [];
    const now = Date.now();

    // Generar alertas más distribuidas en el tiempo
    // Diarias (últimas 24h): 15-20 alertas
    for (let i = 0; i < 18; i++) {
        const type = CRIME_TYPES[Math.floor(Math.random() * CRIME_TYPES.length)];
        const severity = Math.floor(Math.random() * 5) + 1;
        const hoursAgo = Math.random() * 24;
        const statusRand = Math.random();
        let status = 'approved';
        if (statusRand < 0.15) status = 'pending';
        else if (statusRand < 0.25) status = 'rejected';

        alerts.push({
            id: alerts.length,
            type: type.id,
            typeName: type.name,
            typeIcon: type.icon,
            typeColor: type.color,
            severity: severity,
            severityName: SEVERITY_LEVELS[severity - 1].name,
            severityColor: SEVERITY_LEVELS[severity - 1].color,
            zona: ZONAS[Math.floor(Math.random() * ZONAS.length)],
            description: 'Reporte de ' + type.name.toLowerCase() + ' en la zona. ' + 
                        (Math.random() > 0.5 ? 'Situación bajo control.' : 'Requiere atención inmediata.'),
            lat: 14.6349 + (Math.random() - 0.5) * 0.15,
            lng: -90.5069 + (Math.random() - 0.5) * 0.15,
            timestamp: now - (hoursAgo * 3600000),
            verified: Math.random() > 0.3,
            reports: Math.floor(Math.random() * 10) + 1,
            status: status,
            reportedBy: 'Usuario' + Math.floor(Math.random() * 1000)
        });
    }

    // Semanales (últimos 7 días): 40-50 alertas adicionales
    for (let i = 0; i < 45; i++) {
        const type = CRIME_TYPES[Math.floor(Math.random() * CRIME_TYPES.length)];
        const severity = Math.floor(Math.random() * 5) + 1;
        const daysAgo = Math.random() * 7;
        const statusRand = Math.random();
        let status = 'approved';
        if (statusRand < 0.15) status = 'pending';
        else if (statusRand < 0.25) status = 'rejected';

        alerts.push({
            id: alerts.length,
            type: type.id,
            typeName: type.name,
            typeIcon: type.icon,
            typeColor: type.color,
            severity: severity,
            severityName: SEVERITY_LEVELS[severity - 1].name,
            severityColor: SEVERITY_LEVELS[severity - 1].color,
            zona: ZONAS[Math.floor(Math.random() * ZONAS.length)],
            description: 'Reporte de ' + type.name.toLowerCase() + ' en la zona.',
            lat: 14.6349 + (Math.random() - 0.5) * 0.15,
            lng: -90.5069 + (Math.random() - 0.5) * 0.15,
            timestamp: now - (daysAgo * 24 * 3600000),
            verified: Math.random() > 0.35,
            reports: Math.floor(Math.random() * 8) + 1,
            status: status,
            reportedBy: 'Usuario' + Math.floor(Math.random() * 1000)
        });
    }

    // Mensuales (últimos 30 días): 80-100 alertas adicionales
    for (let i = 0; i < 90; i++) {
        const type = CRIME_TYPES[Math.floor(Math.random() * CRIME_TYPES.length)];
        const severity = Math.floor(Math.random() * 5) + 1;
        const daysAgo = 7 + Math.random() * 23; // Entre 7 y 30 días
        const statusRand = Math.random();
        let status = 'approved';
        if (statusRand < 0.12) status = 'pending';
        else if (statusRand < 0.22) status = 'rejected';

        alerts.push({
            id: alerts.length,
            type: type.id,
            typeName: type.name,
            typeIcon: type.icon,
            typeColor: type.color,
            severity: severity,
            severityName: SEVERITY_LEVELS[severity - 1].name,
            severityColor: SEVERITY_LEVELS[severity - 1].color,
            zona: ZONAS[Math.floor(Math.random() * ZONAS.length)],
            description: 'Reporte de ' + type.name.toLowerCase() + ' en la zona.',
            lat: 14.6349 + (Math.random() - 0.5) * 0.15,
            lng: -90.5069 + (Math.random() - 0.5) * 0.15,
            timestamp: now - (daysAgo * 24 * 3600000),
            verified: Math.random() > 0.4,
            reports: Math.floor(Math.random() * 6) + 1,
            status: status,
            reportedBy: 'Usuario' + Math.floor(Math.random() * 1000)
        });
    }

    // Anuales (hasta 365 días): 150-200 alertas adicionales
    for (let i = 0; i < 180; i++) {
        const type = CRIME_TYPES[Math.floor(Math.random() * CRIME_TYPES.length)];
        const severity = Math.floor(Math.random() * 5) + 1;
        const daysAgo = 30 + Math.random() * 335; // Entre 30 y 365 días
        const statusRand = Math.random();
        let status = 'approved';
        if (statusRand < 0.1) status = 'pending';
        else if (statusRand < 0.2) status = 'rejected';

        alerts.push({
            id: alerts.length,
            type: type.id,
            typeName: type.name,
            typeIcon: type.icon,
            typeColor: type.color,
            severity: severity,
            severityName: SEVERITY_LEVELS[severity - 1].name,
            severityColor: SEVERITY_LEVELS[severity - 1].color,
            zona: ZONAS[Math.floor(Math.random() * ZONAS.length)],
            description: 'Reporte de ' + type.name.toLowerCase() + ' histórico.',
            lat: 14.6349 + (Math.random() - 0.5) * 0.15,
            lng: -90.5069 + (Math.random() - 0.5) * 0.15,
            timestamp: now - (daysAgo * 24 * 3600000),
            verified: Math.random() > 0.45,
            reports: Math.floor(Math.random() * 5) + 1,
            status: status,
            reportedBy: 'Usuario' + Math.floor(Math.random() * 1000)
        });
    }

    saveAlertsToStorage();
    updateStats();
}

// ============================================
// FORMATEAR TIEMPO DINÁMICO
// ============================================
function getFormattedTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) {
        return minutes + 'min';
    } else if (hours < 24) {
        return hours + 'h';
    } else {
        return days + 'd';
    }
}

// ============================================
// ACTUALIZAR MAPA
// ============================================
function updateMap() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    const filteredAlerts = alerts.filter(alert => {
        const typeMatch = filters.types.length === 0 || filters.types.includes(alert.type);
        const severityMatch = filters.severity.length === 0 || filters.severity.includes(alert.severity);
        const statusMatch = alert.status === 'approved';
        return typeMatch && severityMatch && statusMatch;
    });

    filteredAlerts.forEach(alert => {
        const timeFormatted = getFormattedTime(alert.timestamp);
        const hoursAgo = Math.floor((Date.now() - alert.timestamp) / 3600000);

        const icon = L.divIcon({
            html: '<div class="custom-marker" style="background: ' + alert.severityColor + ';">' +
                  alert.typeIcon +
                  '<div class="time-badge">' + timeFormatted + '</div>' +
                  '</div>',
            className: '',
            iconSize: [40, 40]
        });

        const marker = L.marker([alert.lat, alert.lng], { icon: icon }).addTo(map);
        
        marker.bindPopup(
            '<div style="min-width: 200px;">' +
            '<h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">' + alert.typeIcon + ' ' + alert.typeName + '</h3>' +
            '<p style="margin-bottom: 0.5rem; color: #6b7280;">' + alert.zona + '</p>' +
            '<div style="background: ' + alert.severityColor + '; color: white; display: inline-block; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.875rem; margin-bottom: 0.5rem;">' +
            alert.severityName +
            '</div>' +
            '<p style="margin-bottom: 0.5rem;">' + alert.description + '</p>' +
            '<div style="display: flex; gap: 1rem; font-size: 0.875rem; color: #6b7280;">' +
            '<span>📊 ' + alert.reports + ' reportes</span>' +
            '<span>⏰ Hace ' + timeFormatted + '</span>' +
            '</div>' +
            (alert.verified ? '<div style="color: #10b981; font-size: 0.875rem; margin-top: 0.5rem;">✓ Verificado</div>' : '') +
            '</div>'
        );

        markers.push(marker);
    });

    document.getElementById('alertCount').textContent = filteredAlerts.length + ' alertas activas';
    updateHeatmap(filteredAlerts);
}

// ============================================
// MAPA DE CALOR
// ============================================
function updateHeatmap(filteredAlerts) {
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }

    const heatData = filteredAlerts.map(alert => [
        alert.lat,
        alert.lng,
        alert.severity / 5
    ]);

    if (heatData.length > 0) {
        heatLayer = L.heatLayer(heatData, {
            radius: 30,
            blur: 25,
            maxZoom: 17,
            gradient: {
                0.0: '#10b981',
                0.25: '#f59e0b',
                0.5: '#ef4444',
                1.0: '#991b1b'
            }
        }).addTo(map);
    }
}

// ============================================
// ACTUALIZACIÓN DE ESTADÍSTICAS
// ============================================
let currentStatsPeriod = 'daily';
let statsHeatmapMap = null;
let statsHeatLayer = null;

function updateStats() {
    const approvedAlerts = alerts.filter(a => a.status === 'approved');
    const totalAlerts = approvedAlerts.length;
    
    // Get alerts for current period
    const periodAlerts = getAlertsForPeriod(currentStatsPeriod);
    const criticalAlerts = periodAlerts.filter(a => a.severity >= 4).length;
    const verifiedAlerts = periodAlerts.filter(a => a.verified).length;
    
    // Calculate percentages
    const criticalPercent = totalAlerts > 0 ? ((criticalAlerts / totalAlerts) * 100).toFixed(1) : 0;
    const verifiedPercent = totalAlerts > 0 ? ((verifiedAlerts / totalAlerts) * 100).toFixed(1) : 0;
    
    // Update main stats cards
    if (document.getElementById('totalAlerts')) {
        document.getElementById('totalAlerts').textContent = totalAlerts;
    }
    if (document.getElementById('periodAlerts')) {
        document.getElementById('periodAlerts').textContent = periodAlerts.length;
    }
    if (document.getElementById('critical')) {
        document.getElementById('critical').textContent = criticalAlerts;
    }
    if (document.getElementById('verified')) {
        document.getElementById('verified').textContent = verifiedAlerts;
    }
    if (document.getElementById('criticalPercent')) {
        document.getElementById('criticalPercent').textContent = criticalPercent + '% del total';
    }
    if (document.getElementById('verifiedPercent')) {
        document.getElementById('verifiedPercent').textContent = verifiedPercent + '% del total';
    }
    
    // Update period labels
    updatePeriodLabels();
    
    // Update zone statistics
    updateZoneStats(periodAlerts);
    
    // Update crime type stats
    updateCrimeTypeStats(periodAlerts);
    
    // Update stats heatmap
    updateStatsHeatmap(periodAlerts);
    
    // Update footer stats
    updateFooterStats();
}

function getAlertsForPeriod(period) {
    const now = Date.now();
    const approvedAlerts = alerts.filter(a => a.status === 'approved');
    
    let cutoffTime;
    switch(period) {
        case 'daily':
            cutoffTime = now - (24 * 3600000); // 24 hours
            break;
        case 'weekly':
            cutoffTime = now - (7 * 24 * 3600000); // 7 days
            break;
        case 'monthly':
            cutoffTime = now - (30 * 24 * 3600000); // 30 days
            break;
        case 'yearly':
            cutoffTime = now - (365 * 24 * 3600000); // 365 days
            break;
        default:
            cutoffTime = now - (24 * 3600000);
    }
    
    return approvedAlerts.filter(a => a.timestamp >= cutoffTime);
}

function updatePeriodLabels() {
    const labels = {
        'daily': 'Últimas 24h',
        'weekly': 'Últimos 7 días',
        'monthly': 'Últimos 30 días',
        'yearly': 'Último año'
    };
    
    const label = labels[currentStatsPeriod];
    
    if (document.getElementById('periodLabel')) {
        document.getElementById('periodLabel').textContent = label;
    }
    if (document.getElementById('heatmapPeriodLabel')) {
        document.getElementById('heatmapPeriodLabel').textContent = label;
    }
    if (document.getElementById('zonesTopPeriodLabel')) {
        document.getElementById('zonesTopPeriodLabel').textContent = label;
    }
}

function updateZoneStats(periodAlerts) {
    // Count incidents by zone
    const zoneCounts = {};
    periodAlerts.forEach(alert => {
        zoneCounts[alert.zona] = (zoneCounts[alert.zona] || 0) + 1;
    });
    
    // Convert to array and sort
    const sortedZones = Object.entries(zoneCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    // Generate HTML
    const zoneStatsHTML = sortedZones.map((zone, index) => {
        const [zoneName, count] = zone;
        const percentage = periodAlerts.length > 0 ? ((count / periodAlerts.length) * 100).toFixed(1) : 0;
        const ranking = index + 1;
        
        // Get severity color based on ranking
        let barColor = '#10b981';
        if (ranking <= 3) barColor = '#dc2626';
        else if (ranking <= 6) barColor = '#f59e0b';
        else barColor = '#3b82f6';
        
        return `
            <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="background: ${barColor}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.875rem;">
                            ${ranking}
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #1f2937;">${zoneName}</div>
                            <div style="font-size: 0.875rem; color: #6b7280;">${count} incidentes (${percentage}%)</div>
                        </div>
                    </div>
                    <div style="font-size: 1.5rem;">
                        ${ranking <= 3 ? '🔴' : ranking <= 6 ? '🟠' : '🔵'}
                    </div>
                </div>
                <div style="background: #f3f4f6; height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: ${barColor}; height: 100%; width: ${percentage}%; transition: width 0.5s;"></div>
                </div>
            </div>
        `;
    }).join('');
    
    if (document.getElementById('zoneStatsList')) {
        document.getElementById('zoneStatsList').innerHTML = zoneStatsHTML || '<p style="color: #6b7280;">No hay datos disponibles</p>';
    }
}

function updateCrimeTypeStats(periodAlerts) {
    // Count by crime type
    const typeCounts = {};
    periodAlerts.forEach(alert => {
        typeCounts[alert.type] = (typeCounts[alert.type] || 0) + 1;
    });
    
    const crimeTypeHTML = CRIME_TYPES.map(crimeType => {
        const count = typeCounts[crimeType.id] || 0;
        const percentage = periodAlerts.length > 0 ? ((count / periodAlerts.length) * 100).toFixed(1) : 0;
        
        return `
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.25rem;">${crimeType.icon}</span>
                        <span style="font-weight: 600; color: #1f2937;">${crimeType.name}</span>
                    </div>
                    <span style="font-weight: bold; color: ${crimeType.color};">${count} (${percentage}%)</span>
                </div>
                <div style="background: #f3f4f6; height: 10px; border-radius: 5px; overflow: hidden;">
                    <div style="background: ${crimeType.color}; height: 100%; width: ${percentage}%; transition: width 0.5s;"></div>
                </div>
            </div>
        `;
    }).join('');
    
    if (document.getElementById('crimeTypeStats')) {
        document.getElementById('crimeTypeStats').innerHTML = crimeTypeHTML;
    }
}

function initStatsHeatmap() {
    const container = document.getElementById('statsHeatmap');
    if (!container) return;
    
    if (statsHeatmapMap) {
        statsHeatmapMap.remove();
    }
    
    statsHeatmapMap = L.map('statsHeatmap').setView([14.6349, -90.5069], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(statsHeatmapMap);
    
    setTimeout(() => statsHeatmapMap.invalidateSize(), 100);
}

function updateStatsHeatmap(periodAlerts) {
    if (!statsHeatmapMap) return;
    
    // Remove existing heat layer
    if (statsHeatLayer) {
        statsHeatmapMap.removeLayer(statsHeatLayer);
    }
    
    // Create heat data
    const heatData = periodAlerts.map(alert => [
        alert.lat,
        alert.lng,
        alert.severity / 5
    ]);
    
    if (heatData.length > 0) {
        statsHeatLayer = L.heatLayer(heatData, {
            radius: 30,
            blur: 25,
            maxZoom: 17,
            gradient: {
                0.0: '#10b981',
                0.25: '#f59e0b',
                0.5: '#ef4444',
                1.0: '#991b1b'
            }
        }).addTo(statsHeatmapMap);
    }
}

function updateFooterStats() {
    const approvedAlerts = alerts.filter(a => a.status === 'approved');
    const last24h = getAlertsForPeriod('daily');
    const criticalAlerts = approvedAlerts.filter(a => a.severity >= 4);
    const verifiedAlerts = approvedAlerts.filter(a => a.verified);
    
    if (document.getElementById('footerTotal')) {
        document.getElementById('footerTotal').textContent = approvedAlerts.length;
    }
    if (document.getElementById('footer24h')) {
        document.getElementById('footer24h').textContent = last24h.length;
    }
    if (document.getElementById('footerCritical')) {
        document.getElementById('footerCritical').textContent = criticalAlerts.length;
    }
    if (document.getElementById('footerVerified')) {
        document.getElementById('footerVerified').textContent = verifiedAlerts.length;
    }
}

// ============================================
// GENERACIÓN DE PDF CON ESTADÍSTICAS
// ============================================
async function generateStatsPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const now = new Date();
    const periodLabels = {
        'daily': 'Últimas 24 horas',
        'weekly': 'Últimos 7 días',
        'monthly': 'Últimos 30 días',
        'yearly': 'Último año'
    };
    
    const periodAlerts = getAlertsForPeriod(currentStatsPeriod);
    const totalAlerts = alerts.filter(a => a.status === 'approved').length;
    const criticalAlerts = periodAlerts.filter(a => a.severity >= 4).length;
    const verifiedAlerts = periodAlerts.filter(a => a.verified).length;
    
    // Add logo
    try {
        const logoImg = await loadImageAsBase64('logo_final.png');
        pdf.addImage(logoImg, 'PNG', 15, 15, 30, 30);
    } catch (e) {
        console.log('Logo no disponible');
    }
    
    // Header
    pdf.setFontSize(24);
    pdf.setTextColor(185, 28, 28);
    pdf.text('INNACRI', 50, 25);
    
    pdf.setFontSize(12);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Sistema de Alertas Ciudadanas', 50, 32);
    
    // Report title
    pdf.setFontSize(18);
    pdf.setTextColor(31, 41, 55);
    pdf.text('Reporte de Estadísticas de Criminalidad', 15, 55);
    
    // Metadata
    pdf.setFontSize(10);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`Período analizado: ${periodLabels[currentStatsPeriod]}`, 15, 65);
    pdf.text(`Fecha de generación: ${now.toLocaleDateString('es-GT')}`, 15, 70);
    pdf.text(`Hora de consulta: ${now.toLocaleTimeString('es-GT')}`, 15, 75);
    pdf.text(`Total de incidentes en base de datos: ${totalAlerts}`, 15, 80);
    
    // Stats boxes
    let yPos = 90;
    
    // Main statistics
    pdf.setFillColor(243, 244, 246);
    pdf.rect(15, yPos, 180, 40, 'F');
    
    pdf.setFontSize(12);
    pdf.setTextColor(31, 41, 55);
    pdf.text('Resumen Ejecutivo', 20, yPos + 8);
    
    pdf.setFontSize(10);
    pdf.text(`• Total de incidentes en período: ${periodAlerts.length}`, 20, yPos + 16);
    pdf.text(`• Incidentes críticos: ${criticalAlerts} (${totalAlerts > 0 ? ((criticalAlerts/totalAlerts)*100).toFixed(1) : 0}%)`, 20, yPos + 22);
    pdf.text(`• Incidentes verificados: ${verifiedAlerts} (${totalAlerts > 0 ? ((verifiedAlerts/totalAlerts)*100).toFixed(1) : 0}%)`, 20, yPos + 28);
    pdf.text(`• Promedio diario: ${(periodAlerts.length / getDaysInPeriod(currentStatsPeriod)).toFixed(1)} incidentes/día`, 20, yPos + 34);
    
    yPos += 50;
    
    // Top 10 Dangerous Zones
    pdf.setFontSize(14);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Top 10 Zonas Más Peligrosas', 15, yPos);
    
    yPos += 8;
    
    const zoneCounts = {};
    periodAlerts.forEach(alert => {
        zoneCounts[alert.zona] = (zoneCounts[alert.zona] || 0) + 1;
    });
    
    const sortedZones = Object.entries(zoneCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    pdf.setFontSize(9);
    pdf.setTextColor(31, 41, 55);
    
    sortedZones.forEach((zone, index) => {
        const [zoneName, count] = zone;
        const percentage = periodAlerts.length > 0 ? ((count / periodAlerts.length) * 100).toFixed(1) : 0;
        
        pdf.text(`${index + 1}. ${zoneName}`, 20, yPos);
        pdf.text(`${count} incidentes (${percentage}%)`, 120, yPos);
        
        // Draw bar
        const barWidth = (percentage / 100) * 70;
        let barColor;
        if (index < 3) barColor = [220, 38, 38];
        else if (index < 6) barColor = [245, 158, 11];
        else barColor = [59, 130, 246];
        
        pdf.setFillColor(...barColor);
        pdf.rect(20, yPos + 2, barWidth, 3, 'F');
        
        yPos += 8;
    });
    
    // Crime type distribution
    yPos += 5;
    if (yPos > 250) {
        pdf.addPage();
        yPos = 20;
    }
    
    pdf.setFontSize(14);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Distribución por Tipo de Crimen', 15, yPos);
    
    yPos += 8;
    
    const typeCounts = {};
    periodAlerts.forEach(alert => {
        typeCounts[alert.type] = (typeCounts[alert.type] || 0) + 1;
    });
    
    pdf.setFontSize(9);
    CRIME_TYPES.forEach(crimeType => {
        const count = typeCounts[crimeType.id] || 0;
        const percentage = periodAlerts.length > 0 ? ((count / periodAlerts.length) * 100).toFixed(1) : 0;
        
        pdf.setTextColor(31, 41, 55);
        pdf.text(`${crimeType.icon} ${crimeType.name}`, 20, yPos);
        pdf.text(`${count} (${percentage}%)`, 120, yPos);
        
        yPos += 6;
    });
    
    // Capture heatmap
    yPos += 10;
    if (yPos > 230) {
        pdf.addPage();
        yPos = 20;
    }
    
    pdf.setFontSize(14);
    pdf.setTextColor(220, 38, 38);
    pdf.text('Mapa de Calor de Incidencias', 15, yPos);
    
    yPos += 5;
    
    try {
        const heatmapElement = document.getElementById('statsHeatmap');
        if (heatmapElement && statsHeatmapMap) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const canvas = await html2canvas(heatmapElement, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 180;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            if (yPos + imgHeight > 280) {
                pdf.addPage();
                yPos = 20;
            }
            
            pdf.addImage(imgData, 'PNG', 15, yPos, imgWidth, imgHeight);
        }
    } catch (e) {
        console.log('Error al capturar mapa:', e);
    }
    
    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(156, 163, 175);
    pdf.text('Generado por INNACRI - Sistema de Alertas Ciudadanas Guatemala', 105, 285, { align: 'center' });
    pdf.text('www.innacri.gt | Datos actualizados en tiempo real', 105, 290, { align: 'center' });
    
    // Save PDF
    const fileName = `INNACRI_Reporte_${currentStatsPeriod}_${now.toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
}

function loadImageAsBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
        };
        img.onerror = reject;
        img.src = url;
    });
}

function getDaysInPeriod(period) {
    switch(period) {
        case 'daily': return 1;
        case 'weekly': return 7;
        case 'monthly': return 30;
        case 'yearly': return 365;
        default: return 1;
    }
}

// ============================================
// FUNCIONALIDAD DE RUTA SEGURA
// ============================================
function initSafeRoute() {
    if (document.getElementById('safeRouteView')) {
        document.getElementById('safeRouteView').innerHTML = '<div style="padding: 2rem; text-align: center;">' +
            '<h2>🛣️ Rutas Seguras</h2>' +
            '<p style="margin-top: 1rem; color: #6b7280;">Función en desarrollo - Pronto podrás planificar rutas seguras evitando zonas de riesgo</p>' +
            '</div>';
    }
}

// ============================================
// ANIMACIÓN DE CONTADORES
// ============================================
function animateCounters() {
    const counters = document.querySelectorAll('[data-count]');
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        let current = 0;
        const increment = Math.ceil(target / 30);
        
        const interval = setInterval(() => {
            current += increment;
            if (current >= target) {
                counter.textContent = target;
                clearInterval(interval);
            } else {
                counter.textContent = current;
            }
        }, 50);
    });
}

// ============================================
// TUTORIAL
// ============================================
function showTutorialIfNeeded() {
    const tutorialSeen = localStorage.getItem('innacri_tutorial_seen');
    if (!tutorialSeen && document.getElementById('tutorialOverlay')) {
        document.getElementById('tutorialOverlay').classList.add('active');
    }
}

function completeTutorial() {
    localStorage.setItem('innacri_tutorial_seen', 'true');
    if (document.getElementById('tutorialOverlay')) {
        document.getElementById('tutorialOverlay').classList.remove('active');
    }
}

function skipTutorial() {
    if (confirm('¿Seguro que quieres saltar el tutorial?')) {
        completeTutorial();
    }
}

// ============================================
// MINIMIZAR/EXPANDIR FILTROS
// ============================================
function toggleFilters() {
    const filtersSidebar = document.getElementById('filtersSidebar');
    const toggleIcon = document.getElementById('toggleIcon');
    const toggleText = document.getElementById('toggleText');
    
    filtersMinimized = !filtersMinimized;
    
    if (filtersMinimized) {
        filtersSidebar.classList.add('minimized');
        if (toggleIcon) toggleIcon.textContent = '▶';
        if (toggleText) toggleText.textContent = 'Filtros';
    } else {
        filtersSidebar.classList.remove('minimized');
        if (toggleIcon) toggleIcon.textContent = '◀';
        if (toggleText) toggleText.textContent = 'Ocultar';
    }
}

// ============================================
// INICIALIZACIÓN DE UI
// ============================================
function initUI() {
    // Crime types para el formulario
    const crimeTypesHTML = CRIME_TYPES.map(type => 
        '<div class="crime-type-btn" data-type="' + type.id + '">' +
        '<div class="icon">' + type.icon + '</div>' +
        '<div class="name">' + type.name + '</div>' +
        '</div>'
    ).join('');
    if (document.getElementById('crimeTypes')) {
        document.getElementById('crimeTypes').innerHTML = crimeTypesHTML;
    }

    // Zonas para el selector
    const zonasHTML = ZONAS.map(zona => 
        '<option value="' + zona + '">' + zona + '</option>'
    ).join('');
    if (document.getElementById('zonaInput')) {
        document.getElementById('zonaInput').innerHTML += zonasHTML;
    }

    // Filtros por tipo
    const typeFiltersHTML = CRIME_TYPES.map(type => 
        '<div class="filter-option">' +
        '<input type="checkbox" id="filter-' + type.id + '" data-type="' + type.id + '">' +
        '<span>' + type.icon + '</span>' +
        '<span style="font-size: 0.875rem;">' + type.name + '</span>' +
        '</div>'
    ).join('');
    if (document.getElementById('typeFilters')) {
        document.getElementById('typeFilters').innerHTML = typeFiltersHTML;
    }

    // Filtros por severidad
    const severityFiltersHTML = SEVERITY_LEVELS.map(level => 
        '<div class="filter-option">' +
        '<input type="checkbox" id="filter-sev-' + level.id + '" data-severity="' + level.id + '">' +
        '<div style="width: 12px; height: 12px; border-radius: 50%; background: ' + level.color + ';"></div>' +
        '<span style="font-size: 0.875rem;">' + level.name + '</span>' +
        '</div>'
    ).join('');
    if (document.getElementById('severityFilters')) {
        document.getElementById('severityFilters').innerHTML = severityFiltersHTML;
    }

    // Event listeners para crime types
    document.querySelectorAll('.crime-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.crime-type-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedCrimeType = this.getAttribute('data-type');
        });
    });

    // Severity slider
    if (document.getElementById('severityInput')) {
        document.getElementById('severityInput').addEventListener('input', function() {
            const level = SEVERITY_LEVELS[this.value - 1];
            if (document.getElementById('severityLabel')) {
                document.getElementById('severityLabel').textContent = level.name;
            }
        });
    }

    // Location buttons
    const useMyLocation = document.getElementById('useMyLocation');
    if (useMyLocation) {
        useMyLocation.addEventListener('click', function() {
            document.querySelectorAll('.location-actions button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            getUserLocation();
        });
    }

    const selectOnMap = document.getElementById('selectOnMap');
    if (selectOnMap) {
        selectOnMap.addEventListener('click', function() {
            document.querySelectorAll('.location-actions button').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            initLocationPicker();
        });
    }

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const mapElement = document.getElementById('map');
            if (mapElement) mapElement.style.display = 'none';
            document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
            const filtersSidebar = document.getElementById('filtersSidebar');
            if (filtersSidebar) filtersSidebar.style.display = 'none';
            const reportBtn = document.getElementById('reportBtn');
            if (reportBtn) reportBtn.style.display = 'none';

            if (view === 'map') {
                if (mapElement) mapElement.style.display = 'block';
                if (filtersSidebar) filtersSidebar.style.display = 'block';
                if (reportBtn) reportBtn.style.display = 'flex';
                setTimeout(() => map.invalidateSize(), 100);
            } else {
                const viewElement = document.getElementById(view + 'View');
                if (viewElement) viewElement.classList.add('active');
            }
        });
    });

    // Report modal
    const reportBtn = document.getElementById('reportBtn');
    if (reportBtn) {
        reportBtn.addEventListener('click', function() {
            const modal = document.getElementById('reportModal');
            if (modal) {
                modal.classList.add('active');
                initLocationPicker();
            }
        });
    }

    const heroReportBtn = document.getElementById('heroReportBtn');
    if (heroReportBtn) {
        heroReportBtn.addEventListener('click', function() {
            const btn = document.getElementById('reportBtn');
            if (btn) btn.click();
        });
    }

    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            const modal = document.getElementById('reportModal');
            if (modal) modal.classList.remove('active');
        });
    }

    const reportModal = document.getElementById('reportModal');
    if (reportModal) {
        reportModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    }

    // Report form submission
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!selectedCrimeType) {
                alert('Por favor selecciona un tipo de crimen');
                return;
            }

            const severity = parseInt(document.getElementById('severityInput').value);
            const zona = document.getElementById('zonaInput').value;
            const description = document.getElementById('descriptionInput').value;

            if (!zona || !description) {
                alert('Por favor completa todos los campos');
                return;
            }

            const type = CRIME_TYPES.find(t => t.id === selectedCrimeType);
            const newAlert = {
                id: alerts.length,
                type: selectedCrimeType,
                typeName: type.name,
                typeIcon: type.icon,
                typeColor: type.color,
                severity: severity,
                severityName: SEVERITY_LEVELS[severity - 1].name,
                severityColor: SEVERITY_LEVELS[severity - 1].color,
                zona: zona,
                description: description,
                lat: selectedLocation.lat,
                lng: selectedLocation.lng,
                timestamp: Date.now(),
                verified: false,
                reports: 1,
                status: 'pending',
                reportedBy: 'Usuario' + Math.floor(Math.random() * 1000)
            };

            alerts.unshift(newAlert);
            saveAlertsToStorage();

            const modal = document.getElementById('reportModal');
            if (modal) modal.classList.remove('active');
            if (reportForm) reportForm.reset();
            selectedCrimeType = '';
            document.querySelectorAll('.crime-type-btn').forEach(b => b.classList.remove('selected'));

            alert('¡Reporte enviado! Será revisado por nuestro equipo de moderación antes de publicarse.');
        });
    }

    // Filters
    document.querySelectorAll('#typeFilters input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const type = this.getAttribute('data-type');
            if (this.checked) {
                filters.types.push(type);
            } else {
                filters.types = filters.types.filter(t => t !== type);
            }
            updateMap();
        });
    });

    document.querySelectorAll('#severityFilters input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const severity = parseInt(this.getAttribute('data-severity'));
            if (this.checked) {
                filters.severity.push(severity);
            } else {
                filters.severity = filters.severity.filter(s => s !== severity);
            }
            updateMap();
        });
    });

    const clearFilters = document.getElementById('clearFilters');
    if (clearFilters) {
        clearFilters.addEventListener('click', function() {
            filters = { types: [], severity: [] };
            document.querySelectorAll('#typeFilters input, #severityFilters input').forEach(cb => {
                cb.checked = false;
            });
            updateMap();
        });
    }

    // Toggle filters button
    const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
    if (toggleFiltersBtn) {
        toggleFiltersBtn.addEventListener('click', toggleFilters);
    }

    // Demo notification button
    const demoNotifBtn = document.getElementById('demoNotifBtn');
    if (demoNotifBtn) {
        demoNotifBtn.addEventListener('click', demoProximityNotification);
    }

    // Time filter buttons for stats
    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentStatsPeriod = this.getAttribute('data-period');
            updateStats();
        });
    });

    // PDF download button
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', async function() {
            this.disabled = true;
            this.textContent = '⏳ Generando PDF...';
            try {
                await generateStatsPDF();
                this.textContent = '✅ PDF Descargado';
                setTimeout(() => {
                    this.innerHTML = '📥 Descargar Reporte PDF';
                    this.disabled = false;
                }, 2000);
            } catch (error) {
                console.error('Error generando PDF:', error);
                this.textContent = '❌ Error al generar';
                setTimeout(() => {
                    this.innerHTML = '📥 Descargar Reporte PDF';
                    this.disabled = false;
                }, 2000);
            }
        });
    }

    // Initialize stats heatmap when stats view is shown
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const originalListener = btn.onclick;
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            if (view === 'stats') {
                setTimeout(() => {
                    if (!statsHeatmapMap) {
                        initStatsHeatmap();
                    }
                    updateStats();
                    if (statsHeatmapMap) {
                        statsHeatmapMap.invalidateSize();
                    }
                }, 100);
            }
        });
    });
}

// ============================================
// INICIALIZACIÓN AL CARGAR
// ============================================
window.addEventListener('load', function() {
    if (document.getElementById('map')) {
        initMap();
    }
    initUI();
    initSafeRoute();
    showTutorialIfNeeded();
    setTimeout(animateCounters, 500);
});
