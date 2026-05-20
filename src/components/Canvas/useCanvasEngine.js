/**
 * useCanvasEngine — Fabric.js canvas setup, grid rendering,
 * snap-to-grid with gutter overlap, hex grid, and tile placement.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Canvas, FabricImage, Rect } from 'fabric';

// Gutter overlap design:
// Tiles have ~120px transparent gutter. The "content area" of a [50x50] tile
// spans 600×600 px (10 map squares × 60px). Adjacent tiles snap so content
// areas are adjacent — causing gutter walls to overlap perfectly.
// SNAP_UNIT = 600 for standard geomorphs (50-square spacing).

/**
 * Draw the square grid in world coordinates using the viewport transform.
 * This gives a truly infinite grid with no DPR/pixel-ratio issues.
 */
function drawSquareGridCtx(ctx, fc, gridSize) {
  const zoom = fc.getZoom();
  const vpt  = fc.viewportTransform;
  const w = fc.width;
  const h = fc.height;

  // Compute visible world bounds from screen corners
  const worldLeft   = -vpt[4] / zoom;
  const worldTop    = -vpt[5] / zoom;
  const worldRight  = (w - vpt[4]) / zoom;
  const worldBottom = (h - vpt[5]) / zoom;

  const majorSize = gridSize * 10;

  ctx.save();
  // Apply viewport transform so we draw in world space
  ctx.setTransform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

  // Minor lines
  const firstX = Math.floor(worldLeft  / gridSize) * gridSize;
  const firstY = Math.floor(worldTop   / gridSize) * gridSize;
  ctx.strokeStyle = 'rgba(0,0,0,0.09)';
  ctx.lineWidth   = 0.5 / zoom;
  ctx.beginPath();
  for (let x = firstX; x <= worldRight;  x += gridSize) { ctx.moveTo(x, worldTop);  ctx.lineTo(x, worldBottom); }
  for (let y = firstY; y <= worldBottom; y += gridSize) { ctx.moveTo(worldLeft, y); ctx.lineTo(worldRight, y);  }
  ctx.stroke();

  // Major lines (snap unit — every 600 world px)
  const mFirstX = Math.floor(worldLeft / majorSize) * majorSize;
  const mFirstY = Math.floor(worldTop  / majorSize) * majorSize;
  ctx.strokeStyle = 'rgba(0,0,0,0.20)';
  ctx.lineWidth   = 1 / zoom;
  ctx.beginPath();
  for (let x = mFirstX; x <= worldRight;  x += majorSize) { ctx.moveTo(x, worldTop);  ctx.lineTo(x, worldBottom); }
  for (let y = mFirstY; y <= worldBottom; y += majorSize) { ctx.moveTo(worldLeft, y); ctx.lineTo(worldRight, y);  }
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a pointy-top hex grid in world coordinates.
 */
function drawHexGridCtx(ctx, fc, hexRadius) {
  const zoom = fc.getZoom();
  const vpt  = fc.viewportTransform;
  const w = fc.width;
  const h = fc.height;

  // Visible world bounds
  const worldLeft   = -vpt[4] / zoom;
  const worldTop    = -vpt[5] / zoom;
  const worldRight  = (w - vpt[4]) / zoom;
  const worldBottom = (h - vpt[5]) / zoom;

  const r  = hexRadius;          // world-space radius
  const cw = r * 2;
  const rh = Math.sqrt(3) * r;

  ctx.save();
  ctx.setTransform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
  ctx.strokeStyle = 'rgba(0,0,0,0.13)';
  ctx.lineWidth   = 0.5 / zoom;
  ctx.beginPath();

  const colMin = Math.floor(worldLeft  / (cw * 0.75)) - 2;
  const colMax = Math.ceil(worldRight  / (cw * 0.75)) + 2;
  const rowMin = Math.floor(worldTop   / rh) - 2;
  const rowMax = Math.ceil(worldBottom / rh) + 2;

  for (let col = colMin; col <= colMax; col++) {
    for (let row = rowMin; row <= rowMax; row++) {
      const cx = col * cw * 0.75 + r;
      const cy = row * rh + (col % 2 === 0 ? 0 : rh / 2) + r;
      for (let i = 0; i < 6; i++) {
        const a1 = (Math.PI / 3) * i       - Math.PI / 6;
        const a2 = (Math.PI / 3) * (i + 1) - Math.PI / 6;
        ctx.moveTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
        ctx.lineTo(cx + r * Math.cos(a2), cy + r * Math.sin(a2));
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Snap a coordinate to the grid, accounting for gutter overlap.
 * snapUnit = 600 for standard 50x50 geomorphs (so walls align).
 */
function snapToGrid(value, snapUnit) {
  return Math.round(value / snapUnit) * snapUnit;
}

/**
 * Snap hex coordinates to nearest hex center.
 */
function snapToHex(x, y, hexRadius) {
  const w = hexRadius * 2;
  const h = Math.sqrt(3) * hexRadius;
  const col = Math.round((x - hexRadius) / (w * 0.75));
  const cy = col % 2 === 0 ? h / 2 : h;
  const row = Math.round((y - cy) / h);
  const snapX = col * w * 0.75 + hexRadius;
  const snapY = row * h + (col % 2 === 0 ? 0 : h / 2) + hexRadius;
  return { x: snapX, y: snapY };
}

/**
 * Check if two Fabric objects' bounding boxes overlap significantly.
 * Returns true if they collide (considering the gutter, so only if
 * content areas overlap, not just gutters).
 */
function checkOverlap(newObj, existingObj, gutterPx = 120) {
  const a = newObj.getBoundingRect();
  const b = existingObj.getBoundingRect();
  // Shrink both boxes by gutter amount so wall overlap is permitted
  const inset = gutterPx;
  return !(
    a.left + inset >= b.left + b.width - inset ||
    a.left + a.width - inset <= b.left + inset ||
    a.top + inset >= b.top + b.height - inset ||
    a.top + a.height - inset <= b.top + inset
  );
}

export function useCanvasEngine({
  canvasRef,
  map,
  activeTool,
  snapToGridEnabled,
  onZoomChange,
  onSelectionChange,
  onObjectModified,
  onAddText,
}) {
  const fabricRef = useRef(null);
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  // Keep a live ref to activeTool so event handlers (created once) always see current value
  const activeToolRef = useRef(activeTool);

  // Undo/Redo stacks
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const isApplyingHistoryRef = useRef(false);

  // ── Init Fabric canvas ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    const container = canvasRef.current.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const fc = new Canvas(canvasRef.current, {
      width: w,
      height: h,
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true,
      fireRightClick: true,
      stopContextMenu: true,
    });

    fabricRef.current = fc;

    // Zoom with mouse wheel
    fc.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = fc.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.min(Math.max(zoom, 0.1), 5);
      fc.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      onZoomChange?.(zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Pan or Place Text
    fc.on('mouse:down', (opt) => {
      const isPanTool = activeToolRef.current === 'pan';
      const isTextTool = activeToolRef.current === 'text';

      if (opt.e.button === 0 && isTextTool) {
        const pointer = fc.getPointer(opt.e);
        onAddText?.(pointer.x, pointer.y);
        return;
      }

      if (opt.e.button === 1 || (opt.e.button === 0 && opt.e.altKey) || (opt.e.button === 0 && isPanTool)) {
        isPanningRef.current = true;
        lastPosRef.current = { x: opt.e.clientX, y: opt.e.clientY };
        fc.setCursor('grabbing');
        fc.selection = false;
      }
    });
    fc.on('mouse:move', (opt) => {
      if (isPanningRef.current) {
        const vpt = fc.viewportTransform.slice();
        vpt[4] += opt.e.clientX - lastPosRef.current.x;
        vpt[5] += opt.e.clientY - lastPosRef.current.y;
        fc.setViewportTransform(vpt);
        lastPosRef.current = { x: opt.e.clientX, y: opt.e.clientY };
      }
    });
    fc.on('mouse:up', () => {
      isPanningRef.current = false;
      // Only re-enable selection if we're not in pan tool mode
      if (activeToolRef.current !== 'pan') {
        fc.selection = true;
      }
      fc.setCursor(activeToolRef.current === 'pan' ? 'grab' : 'default');
    });

    // Selection events
    fc.on('selection:created', (e) => {
      const ids = e.selected?.map(o => o._tileId || o.id).filter(Boolean) ?? [];
      onSelectionChange?.(ids, e.selected ?? []);
    });
    fc.on('selection:updated', (e) => {
      const ids = e.selected?.map(o => o._tileId || o.id).filter(Boolean) ?? [];
      onSelectionChange?.(ids, e.selected ?? []);
    });
    fc.on('selection:cleared', () => {
      onSelectionChange?.([], []);
    });

    // Object events for Undo/Redo
    const saveHistory = () => {
      if (isApplyingHistoryRef.current) return;
      const fcInstance = fabricRef.current;
      if (!fcInstance) return;
      
      const canvasJSON = fcInstance.toJSON([
        '_tileId',
        '_tilePath',
        '_snapToGrid',
        '_allowOverlap',
        '_isSymbol',
        '_isTransparent',
        '_rotation',
        'selectable',
        'hasControls'
      ]);
      const objectsState = canvasJSON.objects || [];
      undoStackRef.current.push(JSON.stringify(objectsState));
      redoStackRef.current = []; // Clear redo stack on new action
    };

    fc.on('object:modified', (e) => {
      saveHistory();
      onObjectModified?.(e.target);
    });
    fc.on('object:added', (e) => {
      if (!isApplyingHistoryRef.current && !e.target._isGrid) {
        saveHistory();
        onObjectModified?.(e.target);
      }
    });
    fc.on('object:removed', (e) => {
      if (!isApplyingHistoryRef.current && !e.target._isGrid) {
        saveHistory();
        onObjectModified?.(e.target);
      }
    });

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (!fc) return;
      fc.setWidth(container.clientWidth);
      fc.setHeight(container.clientHeight);
      fc.requestRenderAll();
    });
    resizeObserver.observe(container);

    // ── Infinite grid via before:render ───────────────
    // This draws directly onto the canvas context behind the objects.
    const mapRef = { current: map };
    
    const drawGrid = ({ ctx }) => {
      const m = mapRef.current;
      if (!m.showGrid) return;
      
      const zoom = fc.getZoom();
      const vpt  = fc.viewportTransform;
      const w = fc.width;
      const h = fc.height;

      // Visible world bounds
      const worldLeft   = -vpt[4] / zoom;
      const worldTop    = -vpt[5] / zoom;
      const worldRight  = (w - vpt[4]) / zoom;
      const worldBottom = (h - vpt[5]) / zoom;

      ctx.save();
      ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
      ctx.beginPath();
      
      if (m.gridType === 'hex') {
        const r  = m.gridSize / 2;
        const cw = r * 2;
        const rh = Math.sqrt(3) * r;
        ctx.strokeStyle = 'rgba(0,0,0,0.13)';
        ctx.lineWidth   = 0.5 / zoom;
        const colMin = Math.floor(worldLeft  / (cw * 0.75)) - 2;
        const colMax = Math.ceil(worldRight  / (cw * 0.75)) + 2;
        const rowMin = Math.floor(worldTop   / rh) - 2;
        const rowMax = Math.ceil(worldBottom / rh) + 2;
        for (let col = colMin; col <= colMax; col++) {
          for (let row = rowMin; row <= rowMax; row++) {
            const cx = col * cw * 0.75 + r;
            const cy = row * rh + (col % 2 === 0 ? 0 : rh / 2) + r;
            for (let i = 0; i < 6; i++) {
              const a1 = (Math.PI / 3) * i       - Math.PI / 6;
              const a2 = (Math.PI / 3) * (i + 1) - Math.PI / 6;
              ctx.moveTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
              ctx.lineTo(cx + r * Math.cos(a2), cy + r * Math.sin(a2));
            }
          }
        }
      } else {
        // Square grid
        const gridSize = m.gridSize;
        const majorSize = gridSize * 10;
        
        // Minor lines
        const firstX = Math.floor(worldLeft  / gridSize) * gridSize;
        const firstY = Math.floor(worldTop   / gridSize) * gridSize;
        ctx.strokeStyle = 'rgba(0,0,0,0.09)';
        ctx.lineWidth   = 0.5 / zoom;
        for (let x = firstX; x <= worldRight;  x += gridSize) { ctx.moveTo(x, worldTop);  ctx.lineTo(x, worldBottom); }
        for (let y = firstY; y <= worldBottom; y += gridSize) { ctx.moveTo(worldLeft, y); ctx.lineTo(worldRight, y);  }
        ctx.stroke();
        
        // Major lines
        ctx.beginPath();
        const mFirstX = Math.floor(worldLeft / majorSize) * majorSize;
        const mFirstY = Math.floor(worldTop  / majorSize) * majorSize;
        ctx.strokeStyle = 'rgba(0,0,0,0.20)';
        ctx.lineWidth   = 1 / zoom;
        for (let x = mFirstX; x <= worldRight;  x += majorSize) { ctx.moveTo(x, worldTop);  ctx.lineTo(x, worldBottom); }
        for (let y = mFirstY; y <= worldBottom; y += majorSize) { ctx.moveTo(worldLeft, y); ctx.lineTo(worldRight, y);  }
      }
      ctx.stroke();
      ctx.restore();
    };

    fc._gridMapRef = mapRef;
    fc.on('before:render', drawGrid);

    return () => {
      resizeObserver.disconnect();
      fc.off('before:render', drawGrid);
      fc.dispose();
      fabricRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only init once

  // ── Re-apply grid when settings change ────────────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    if (fc._gridMapRef) fc._gridMapRef.current = map; // keep closure fresh
    fc.requestRenderAll();
  }, [map.showGrid, map.gridType, map.gridSize, map]);

  // ── Sync canvas objects when map ID changes (Load Map) ──────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    isApplyingHistoryRef.current = true;

    // Clear existing user objects (leave grid as it is rendering dynamically)
    fc.clear();
    fc.discardActiveObject();

    let objs = map.objects;
    if (typeof objs === 'string') {
      try {
        objs = JSON.parse(objs);
      } catch (e) {
        console.error('Failed to parse map objects:', e);
        objs = [];
      }
    }

    // Initialize history stack with loaded state
    undoStackRef.current = [JSON.stringify(objs || [])];
    redoStackRef.current = [];

    if (objs && objs.length > 0) {
      const canvasData = { objects: objs };
      fc.loadFromJSON(canvasData).then(() => {
        // Restore controls visibility on tiles
        fc.getObjects().forEach(obj => {
          if (obj.type === 'image') {
            obj.setControlsVisibility({
              ml: false, mr: false, mb: false, mt: false,
              mtr: false,
            });
          }
        });
        isApplyingHistoryRef.current = false;
        fc.requestRenderAll();
      });
    } else {
      isApplyingHistoryRef.current = false;
      fc.requestRenderAll();
    }
  }, [map.id]);

  // ── Sync canvas background colour ────────────────────────────────────────────
  // (Background colour is applied to the .canvas-container div in CanvasEditor,
  // so the canvas itself stays transparent and allows the before:render grid to show)

  useEffect(() => {
    activeToolRef.current = activeTool;
    const fc = fabricRef.current;
    if (!fc) return;
    if (activeTool === 'pan') {
      fc.defaultCursor = 'grab';
      fc.hoverCursor = 'grab';
      fc.selection = false;
    } else if (activeTool === 'text') {
      fc.defaultCursor = 'text';
      fc.hoverCursor = 'text';
      fc.selection = false;
    } else {
      fc.defaultCursor = 'default';
      fc.hoverCursor = 'move';
      fc.selection = true;
    }
  }, [activeTool]);

  // ── Place a tile on the canvas ─────────────────────────────────────────────
  const placeTile = useCallback(async (tile, dropX, dropY) => {
    const fc = fabricRef.current;
    if (!fc) return;

    // Load image
    let img;
    try {
      img = await FabricImage.fromURL(`/${tile.path}`, { crossOrigin: 'anonymous' });
    } catch (err) {
      console.error('Failed to load tile:', tile.path, err);
      return;
    }

    // Determine defaults based on tile type
    const isSymbol = tile.isSymbol;
    // User requested symbols to snap to grid by default and not be transparent
    const useSnap = snapToGridEnabled;
    const allowOverlap = tile.isOverlay; // Remove isSymbol from forcing overlap by default
    const isTransparent = !isSymbol; // Symbols get solid white background by default

    // Calculate canvas coordinates from drop position
    const vpt = fc.viewportTransform;
    const zoom = fc.getZoom();
    const canvasX = (dropX - vpt[4]) / zoom;
    const canvasY = (dropY - vpt[5]) / zoom;

    // Snap to grid — coordinates are the tile CENTRE (because originX/Y = 'center')
    let cx, cy;
    if (useSnap) {
      if (map.gridType === 'hex') {
        const snapped = snapToHex(canvasX, canvasY, map.gridSize / 2);
        cx = snapped.x;
        cy = snapped.y;
      } else {
        // Square grid
        // If it's a symbol, snap to the basic grid size. 
        // If it's a geomorph, snap to the 600px content unit.
        const unit = isSymbol ? map.gridSize : map.snapUnit;
        const tl_x = snapToGrid(canvasX - img.width / 2, unit);
        const tl_y = snapToGrid(canvasY - img.height / 2, unit);
        cx = tl_x + img.width / 2;
        cy = tl_y + img.height / 2;
      }
    } else {
      cx = canvasX;
      cy = canvasY;
    }

    img.set({
      left: cx,
      top: cy,
      originX: 'center',
      originY: 'center',
      selectable: true,
      hasControls: true,
      hasBorders: true,
      lockRotation: false,
      backgroundColor: isTransparent ? 'transparent' : '#ffffff',
      // Store metadata
      _tileId: tile.id,
      _tilePath: tile.path,
      _snapToGrid: useSnap,
      _allowOverlap: allowOverlap,
      _isSymbol: isSymbol,
      _isTransparent: isTransparent,
      _rotation: 0,
    });

    // Remove Fabric's default scale controls; we use our own rotation
    img.setControlsVisibility({
      ml: false, mr: false, mb: false, mt: false, // mid handles
      mtr: false, // rotation handle — we use own UI
    });

    // Overlap check (skip for symbols/overlays)
    if (!allowOverlap) {
      const others = fc.getObjects().filter(o => !o._isGrid && o !== img);
      for (const other of others) {
        if (!other._allowOverlap && checkOverlap(img, other)) {
          // Placement blocked — flash red border briefly as feedback
          const tempRect = new Rect({
            left: cx, top: cy,
            originX: 'center', originY: 'center',
            width: img.width, height: img.height,
            fill: 'rgba(239,68,68,0.2)', stroke: '#ef4444', strokeWidth: 2,
            selectable: false, evented: false,
          });
          fc.add(tempRect);
          setTimeout(() => fc.remove(tempRect), 600);
          fc.requestRenderAll();
          return;
        }
      }
    }

    fc.add(img);
    fc.setActiveObject(img);
    fc.requestRenderAll();
    return img;
  }, [snapToGridEnabled, map]);

  // ── Snap on object move ───────────────────────────────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const handleMoving = (e) => {
      const obj = e.target;
      if (!obj._snapToGrid || !snapToGridEnabled || e.e?.altKey) return;
      // obj.left/top = centre of object (originX/Y = 'center')
      if (map.gridType === 'hex') {
        const snapped = snapToHex(obj.left, obj.top, map.gridSize / 2);
        obj.set({ left: snapped.x, top: snapped.y });
      } else {
        // Snap the implied top-left, then re-derive centre
        const w = obj.width * obj.scaleX;
        const h = obj.height * obj.scaleY;
        const unit = obj._isSymbol ? map.gridSize : map.snapUnit;
        const tl_x = snapToGrid(obj.left - w / 2, unit);
        const tl_y = snapToGrid(obj.top  - h / 2, unit);
        obj.set({ left: tl_x + w / 2, top: tl_y + h / 2 });
      }
    };

    fc.on('object:moving', handleMoving);
    return () => fc.off('object:moving', handleMoving);
  }, [snapToGridEnabled, map.gridType, map.gridSize, map.snapUnit]);

  // ── Rotate selected object ────────────────────────────────────────────────────
  const rotateSelected = useCallback((degrees) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const obj = fc.getActiveObject();
    if (!obj) return;
    const current = obj.angle || 0;
    obj.set({ angle: (current + degrees) % 360 });
    obj._rotation = obj.angle;
    fc.requestRenderAll();
    onObjectModified?.(obj);
  }, [onObjectModified]);

  // ── Nudge selected object ──────────────────────────────────────────────────────
  const nudgeSelected = useCallback((dx, dy) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const obj = fc.getActiveObject();
    if (!obj) return;
    obj.set({
      left: obj.left + dx,
      top: obj.top + dy,
    });
    fc.requestRenderAll();
    onObjectModified?.(obj);
  }, [onObjectModified]);

  // ── Delete selected ───────────────────────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const active = fc.getActiveObjects();
    active.forEach(obj => fc.remove(obj));
    fc.discardActiveObject();
    fc.requestRenderAll();
  }, []);

  // ── Get/set selected object properties ───────────────────────────────────────
  const getSelectedProps = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return null;
    const obj = fc.getActiveObject();
    if (!obj || obj._isGrid) return null;
    return {
      x: Math.round(obj.left),
      y: Math.round(obj.top),
      rotation: obj.angle || 0,
      snapToGrid: obj._snapToGrid ?? true,
      allowOverlap: obj._allowOverlap ?? false,
      isSymbol: obj._isSymbol ?? false,
      isTransparent: obj._isTransparent ?? true,
      tileId: obj._tileId,
      type: obj.type,
      text: obj.text,
      fontSize: obj.fontSize,
      fill: obj.fill,
    };
  }, []);

  const updateSelectedProp = useCallback((key, value) => {
    const fc = fabricRef.current;
    if (!fc) return;
    const obj = fc.getActiveObject();
    if (!obj) return;
    if (key === 'x') obj.set({ left: Number(value) });
    else if (key === 'y') obj.set({ top: Number(value) });
    else if (key === 'rotation') obj.set({ angle: Number(value) });
    else if (key === 'snapToGrid') obj._snapToGrid = value;
    else if (key === 'allowOverlap') obj._allowOverlap = value;
    else if (key === 'isTransparent') {
      obj._isTransparent = value;
      obj.set({ backgroundColor: value ? 'transparent' : '#ffffff' });
    } else if (key === 'fontSize') {
      obj.set({ fontSize: Number(value) });
    } else if (key === 'fill') {
      obj.set({ fill: value });
    }
    fc.requestRenderAll();
    onObjectModified?.(obj);
  }, [onObjectModified]);

  // ── Get canvas objects serialized ──────────────────────────────────────────
  const getObjectsJSON = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return [];
    const canvasJSON = fc.toJSON([
      '_tileId',
      '_tilePath',
      '_snapToGrid',
      '_allowOverlap',
      '_isSymbol',
      '_isTransparent',
      '_rotation',
      'selectable',
      'hasControls'
    ]);
    return canvasJSON.objects || [];
  }, []);

  // ── Export canvas to PNG ──────────────────────────────────────────────────────
  const exportToPNG = useCallback((withGrid = false) => {
    const fc = fabricRef.current;
    if (!fc) return;
    
    const prevShow = map.showGrid;
    const prevBg = fc.backgroundColor;

    if (!withGrid && fc._gridMapRef) {
      fc._gridMapRef.current = { ...fc._gridMapRef.current, showGrid: false };
    }

    // Set canvas background to map background color for solid PNG export
    fc.backgroundColor = map.backgroundColor || '#ffffff';
    fc.requestRenderAll();

    // Export at standard resolution (multiplier: 1)
    const dataURL = fc.toDataURL({ format: 'png', multiplier: 1 });

    // Restore settings
    if (!withGrid && fc._gridMapRef) {
      fc._gridMapRef.current = { ...fc._gridMapRef.current, showGrid: prevShow };
    }
    fc.backgroundColor = prevBg;
    fc.requestRenderAll();

    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${map.name || 'geomorphforge-map'}.png`;
    a.click();
  }, [map.showGrid, map.name, map.backgroundColor]);

  // ── Undo / Redo Actions ─────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc || undoStackRef.current.length <= 1) return;

    const currentState = undoStackRef.current.pop();
    redoStackRef.current.push(currentState);

    const prevState = undoStackRef.current[undoStackRef.current.length - 1];
    isApplyingHistoryRef.current = true;

    fc.clear();
    fc.discardActiveObject();
    
    fc.loadFromJSON({ objects: JSON.parse(prevState) }).then(() => {
      // Restore controls visibility on tiles
      fc.getObjects().forEach(obj => {
        if (obj.type === 'image') {
          obj.setControlsVisibility({
            ml: false, mr: false, mb: false, mt: false,
            mtr: false,
          });
        }
      });
      isApplyingHistoryRef.current = false;
      fc.requestRenderAll();
      onObjectModified?.();
    });
  }, [onObjectModified]);

  const redo = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc || redoStackRef.current.length === 0) return;

    const nextState = redoStackRef.current.pop();
    undoStackRef.current.push(nextState);

    isApplyingHistoryRef.current = true;

    fc.clear();
    fc.discardActiveObject();
    
    fc.loadFromJSON({ objects: JSON.parse(nextState) }).then(() => {
      // Restore controls visibility on tiles
      fc.getObjects().forEach(obj => {
        if (obj.type === 'image') {
          obj.setControlsVisibility({
            ml: false, mr: false, mb: false, mt: false,
            mtr: false,
          });
        }
      });
      isApplyingHistoryRef.current = false;
      fc.requestRenderAll();
      onObjectModified?.();
    });
  }, [onObjectModified]);

  return {
    fabricRef,
    placeTile,
    rotateSelected,
    nudgeSelected,
    deleteSelected,
    getSelectedProps,
    updateSelectedProp,
    getObjectsJSON,
    exportToPNG,
    undo,
    redo,
  };
}
