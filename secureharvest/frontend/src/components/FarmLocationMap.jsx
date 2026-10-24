import React, { useEffect, useMemo, useRef, useState } from 'react';

const TILE_SIZE = 256;
const DEFAULT_CENTER = { latitude: 15.4589, longitude: 75.0078 };
const EMPTY_MARKERS = [];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function toWorldPoint({ latitude, longitude }, zoom) {
  const scale = TILE_SIZE * (2 ** zoom);
  const lat = clamp(latitude, -85.0511, 85.0511) * Math.PI / 180;
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + Math.sin(lat)) / (1 - Math.sin(lat))) / (4 * Math.PI)) * scale
  };
}

function fromWorldPoint({ x, y }, zoom) {
  const scale = TILE_SIZE * (2 ** zoom);
  const wrappedX = ((x % scale) + scale) % scale;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180 / Math.PI;
  return {
    latitude: clamp(latitude, -85.0511, 85.0511),
    longitude: (wrappedX / scale) * 360 - 180
  };
}

export default function FarmLocationMap({ value, onChange, onPlaceResolved, query = '', readOnly = false, markers = EMPTY_MARKERS, boundary = [], onBoundaryChange, drawingBoundary = false }) {
  const mapRef = useRef(null);
  const dragRef = useRef(null);
  const reverseTimerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 320 });
  const [center, setCenter] = useState(value || DEFAULT_CENTER);
  const [zoom, setZoom] = useState(13);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    if (value?.latitude != null && value?.longitude != null) setCenter(value);
  }, [value?.latitude, value?.longitude]);

  useEffect(() => {
    const valid = markers.filter((marker) => Number.isFinite(Number(marker.latitude)) && Number.isFinite(Number(marker.longitude)));
    if (!valid.length) return;
    const minLat = Math.min(...valid.map((marker) => Number(marker.latitude)));
    const maxLat = Math.max(...valid.map((marker) => Number(marker.latitude)));
    const minLon = Math.min(...valid.map((marker) => Number(marker.longitude)));
    const maxLon = Math.max(...valid.map((marker) => Number(marker.longitude)));
    setCenter({ latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2 });
    const span = Math.max(maxLat - minLat, (maxLon - minLon) * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180), 0.025);
    setZoom(clamp(Math.floor(Math.log2(120 / span)), 3, 13));
  }, [markers]);

  useEffect(() => {
    if (!mapRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => clearTimeout(reverseTimerRef.current), []);

  const centerPoint = useMemo(() => toWorldPoint(center, zoom), [center, zoom]);
  const selectedPoint = useMemo(
    () => value?.latitude != null && value?.longitude != null ? toWorldPoint(value, zoom) : null,
    [value?.latitude, value?.longitude, zoom]
  );

  const tiles = useMemo(() => {
    if (!size.width) return [];
    const count = 2 ** zoom;
    const firstX = Math.floor((centerPoint.x - size.width / 2) / TILE_SIZE);
    const lastX = Math.floor((centerPoint.x + size.width / 2) / TILE_SIZE);
    const firstY = Math.floor((centerPoint.y - size.height / 2) / TILE_SIZE);
    const lastY = Math.floor((centerPoint.y + size.height / 2) / TILE_SIZE);
    const items = [];
    for (let tileY = firstY; tileY <= lastY; tileY += 1) {
      if (tileY < 0 || tileY >= count) continue;
      for (let tileX = firstX; tileX <= lastX; tileX += 1) {
        const wrappedX = ((tileX % count) + count) % count;
        items.push({
          key: `${zoom}-${wrappedX}-${tileY}`,
          src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
          left: tileX * TILE_SIZE - centerPoint.x + size.width / 2,
          top: tileY * TILE_SIZE - centerPoint.y + size.height / 2
        });
      }
    }
    return items;
  }, [centerPoint, size, zoom]);

  const markerPosition = selectedPoint && size.width
    ? {
        left: size.width / 2 + selectedPoint.x - centerPoint.x,
        top: size.height / 2 + selectedPoint.y - centerPoint.y
      }
    : null;
  const displayMarkers = markers.filter((marker) => Number.isFinite(Number(marker.latitude)) && Number.isFinite(Number(marker.longitude)));
  const exposurePositions = displayMarkers.map((marker) => {
    const point = toWorldPoint(marker, zoom);
    return { ...marker, left: size.width / 2 + point.x - centerPoint.x, top: size.height / 2 + point.y - centerPoint.y };
  });
  const boundaryPositions = boundary.map((point) => {
    const world = toWorldPoint(point, zoom);
    return { x: size.width / 2 + world.x - centerPoint.x, y: size.height / 2 + world.y - centerPoint.y };
  });

  const pointAt = (event) => {
    const rect = mapRef.current.getBoundingClientRect();
    return fromWorldPoint({
      x: centerPoint.x + event.clientX - rect.left - size.width / 2,
      y: centerPoint.y + event.clientY - rect.top - size.height / 2
    }, zoom);
  };

  const handlePointerDown = (event) => {
    if (readOnly || event.target.closest('.farm-map-controls')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      center: centerPoint,
      moved: false
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) drag.moved = true;
    if (!drag.moved) return;
    setCenter(fromWorldPoint({ x: drag.center.x - deltaX, y: drag.center.y - deltaY }, zoom));
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && !readOnly) {
      const point = pointAt(event);
      if (drawingBoundary) onBoundaryChange?.([...boundary, point]);
      else {
        onChange(point);
        clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = setTimeout(() => reverseLocate(point), 1000);
      }
    }
    dragRef.current = null;
  };

  const reverseLocate = async (point) => {
    setLocating(true);
    setMapError('');
    try {
      const params = new URLSearchParams({
        lat: point.latitude.toFixed(6),
        lon: point.longitude.toFixed(6),
        format: 'jsonv2',
        zoom: '14',
        addressdetails: '1'
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
      if (!response.ok) throw new Error('Could not look up the selected map location.');
      const result = await response.json();
      const address = result.address || {};
      const locality = address.city || address.town || address.village || address.municipality || address.suburb || address.county;
      const place = [locality, address.state, address.country].filter(Boolean).join(', ') || result.display_name;
      if (place) onPlaceResolved?.(place);
    } catch (error) {
      setMapError(error.message || 'Could not look up the selected map location.');
    } finally {
      setLocating(false);
    }
  };

  const handleMapKeyDown = (event) => {
    const directions = {
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0]
    };
    const direction = directions[event.key];
    if (!direction || readOnly) return;
    event.preventDefault();
    const point = value || center;
    const longitudeStep = 360 / (TILE_SIZE * (2 ** zoom));
    const latitudeStep = longitudeStep * Math.cos(point.latitude * Math.PI / 180);
    const nextPoint = {
      latitude: clamp(point.latitude + direction[1] * latitudeStep, -85.0511, 85.0511),
      longitude: clamp(point.longitude + direction[0] * longitudeStep, -180, 180)
    };
    setCenter(nextPoint);
    onChange(nextPoint);
  };

  const locatePlace = async () => {
    if (!query.trim()) return;
    setLocating(true);
    setMapError('');
    try {
      const params = new URLSearchParams({ q: query.trim(), format: 'jsonv2', limit: '1' });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!response.ok) throw new Error('Location search is unavailable right now.');
      const matches = await response.json();
      if (!matches.length) throw new Error('Could not find that place. Try adding a district or country.');
      const point = { latitude: Number(matches[0].lat), longitude: Number(matches[0].lon) };
      setCenter(point);
      onChange?.(point);
    } catch (error) {
      setMapError(error.message || 'Could not locate this place.');
    } finally {
      setLocating(false);
    }
  };

  const changeZoom = (amount) => setZoom((current) => clamp(current + amount, 3, 18));

  return (
    <div className="farm-map-card">
      <div className="farm-map-heading">
        <div>
          <strong>{readOnly ? 'Farm location' : 'Pin your farm on the map'}</strong>
          <p>{readOnly ? 'Approximate plot pin; this is not a surveyed boundary.' : 'Search or click the map to set the pin. A click also fills the location from the map.'}</p>
        </div>
        {!readOnly && (
          <button type="button" className="btn-secondary farm-map-locate" onClick={locatePlace} disabled={locating || !query.trim()}>
            {locating ? 'Finding place…' : 'Find location'}
          </button>
        )}
      </div>
      {mapError && <p className="inline-error" role="alert">{mapError}</p>}
      <div
        ref={mapRef}
        className={`farm-map ${readOnly ? 'farm-map-readonly' : ''}`}
        role={readOnly ? 'img' : 'application'}
        tabIndex={readOnly ? -1 : 0}
        aria-label={readOnly ? 'Map showing the selected farm pin' : 'Interactive map; click to place the farm pin, drag to pan, and use arrow keys to nudge the pin'}
        onKeyDown={handleMapKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        {tiles.map((tile) => (
          <img key={tile.key} className="farm-map-tile" src={tile.src} alt="" draggable="false" style={{ left: tile.left, top: tile.top }} />
        ))}
        {boundaryPositions.length > 0 && <svg className="farm-map-boundary" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true"><polygon points={boundaryPositions.map((point) => `${point.x},${point.y}`).join(' ')} /><polyline points={boundaryPositions.map((point) => `${point.x},${point.y}`).join(' ')} /></svg>}
        {!markers.length && markerPosition && !drawingBoundary && (
          <div className="farm-map-marker" style={markerPosition} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
              <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" fill="#b54436" stroke="#fff" strokeWidth="1.5" />
              <circle cx="12" cy="10" r="2.5" fill="#fff" />
            </svg>
          </div>
        )}
        {exposurePositions.map((marker) => <div key={marker.id} className="farm-exposure-marker" style={{ left: marker.left, top: marker.top }} title={`${marker.label}: ${marker.detail}`}><span /></div>)}
        {!readOnly && (
          <div className="farm-map-controls" aria-label="Map zoom controls">
            <button type="button" onClick={() => changeZoom(1)} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => changeZoom(-1)} aria-label="Zoom out">−</button>
          </div>
        )}
        {!value && !readOnly && !drawingBoundary && <span className="farm-map-hint">Click to place farm pin</span>}
        {drawingBoundary && <span className="farm-map-hint">Click to outline the farm boundary</span>}
        <a className="farm-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      </div>
      {value?.latitude != null && value?.longitude != null ? (
        <p className="farm-map-coordinates">Pin: {Number(value.latitude).toFixed(5)}, {Number(value.longitude).toFixed(5)}</p>
      ) : !readOnly ? (
        <p className="farm-map-coordinates">No pin selected yet.</p>
      ) : null}
    </div>
  );
}
