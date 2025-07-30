import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, Heart, Download, Upload, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

export interface Person {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
}

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: RelationshipType;
  customLabel?: string; // For custom relationships
  customPattern?: 'solid' | 'dashed' | 'dotted'; // For custom line pattern
}

export type RelationshipType = 
  | 'committed-nesting'
  | 'committed' 
  | 'budding'
  | 'sexual'
  | 'platonic'
  | 'queer-platonic'
  | 'partner'
  | 'play'
  | 'custom';

const relationshipTypes: { value: RelationshipType; label: string; description: string; color: string; pattern: string }[] = [
  { value: 'committed-nesting', label: 'Committed Partnership - Nesting', description: 'Living together committed relationship', color: '#3b82f6', pattern: 'solid' },
  { value: 'committed', label: 'Committed Partnership', description: 'Committed romantic relationship', color: '#3b82f6', pattern: 'dashed' },
  { value: 'budding', label: 'Budding Romantic', description: 'New or developing romantic connection', color: '#3b82f6', pattern: 'dotted' },
  { value: 'sexual', label: 'Sexual Partnership', description: 'Primarily sexual relationship', color: '#1f2937', pattern: 'dashed' },
  { value: 'platonic', label: 'Platonic Friendship', description: 'Close platonic friend', color: '#6b7280', pattern: 'dashed' },
  { value: 'queer-platonic', label: 'Queer Platonic', description: 'Queer platonic partnership', color: '#8b5cf6', pattern: 'solid' },
  { value: 'partner', label: 'Partner', description: 'General partnership', color: '#ec4899', pattern: 'solid' },
  { value: 'play', label: 'Play Partner', description: 'Kink/play relationship', color: '#f59e0b', pattern: 'dashed' },
  { value: 'custom', label: 'Custom', description: 'Create your own relationship type', color: '#6366f1', pattern: 'solid' }
];

const nodeColors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const PolyMapper: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [selectedFrom, setSelectedFrom] = useState<string>('');
  const [selectedTo, setSelectedTo] = useState<string>('');
  const [selectedRelType, setSelectedRelType] = useState<RelationshipType>('committed');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPerson, setDraggedPerson] = useState<Person | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isZooming, setIsZooming] = useState(false);
  const [lastZoomDistance, setLastZoomDistance] = useState(0);
  
  // Simple custom relationship state
  const [customLabel, setCustomLabel] = useState('');
  const [customPattern, setCustomPattern] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  
  const isMobile = useIsMobile();
  const nodeRadius = isMobile ? 35 : 25; // Larger touch targets on mobile

  // Auto-resize canvas with mobile-aware sizing
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          let width: number;
          let height: number;
          
          if (isMobile) {
            // Mobile: Use most of the viewport width, ensure minimum viable size
            width = Math.max(300, container.offsetWidth - 20);
            height = Math.max(400, Math.min(500, window.innerHeight * 0.4));
          } else {
            // Desktop: Keep existing logic
            width = Math.min(container.offsetWidth - 40, 1000);
            height = Math.min(600, window.innerHeight * 0.5);
          }
          
          setCanvasSize({ width, height });
        }
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [isMobile]);

  const drawNetwork = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution to match display size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Apply zoom transformation
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);

    // Draw relationships first (behind nodes)
    relationships.forEach(rel => {
      const fromPerson = people.find(p => p.id === rel.from);
      const toPerson = people.find(p => p.id === rel.to);
      
      if (fromPerson && toPerson) {
        drawRelationship(ctx, fromPerson, toPerson, rel);
      }
    });

    // Draw people nodes on top
    people.forEach(person => {
      drawPerson(ctx, person);
    });

    // Restore context
    ctx.restore();
  }, [people, relationships, panOffset, zoomLevel]);

  const drawPerson = (ctx: CanvasRenderingContext2D, person: Person) => {
    // Draw node circle with pan offset
    const x = person.x + panOffset.x;
    const y = person.y + panOffset.y;
    
    ctx.beginPath();
    ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
    
    // Gradient fill
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, nodeRadius);
    gradient.addColorStop(0, person.color);
    gradient.addColorStop(1, person.color + '80');
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Border
    ctx.strokeStyle = person.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(person.name, x, y);
  };

  const drawRelationship = (ctx: CanvasRenderingContext2D, from: Person, to: Person, relationship: Relationship) => {
    const relType = getRelationshipTypeDetails(relationship);
    if (!relType) return;

    const fromX = from.x + panOffset.x;
    const fromY = from.y + panOffset.y;
    const toX = to.x + panOffset.x;
    const toY = to.y + panOffset.y;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    
    ctx.strokeStyle = relType.color;
    ctx.lineWidth = 3;

    // Set line pattern
    switch (relType.pattern) {
      case 'solid':
        ctx.setLineDash([]);
        break;
      case 'dashed':
        ctx.setLineDash([8, 5]);
        break;
      case 'dotted':
        ctx.setLineDash([2, 5]);
        break;
    }

    ctx.stroke();
    ctx.setLineDash([]); // Reset

    // Draw arrows
    const fromWithOffset = { ...from, x: fromX, y: fromY };
    const toWithOffset = { ...to, x: toX, y: toY };
    drawArrow(ctx, fromWithOffset, toWithOffset, relType.color);
    drawArrow(ctx, toWithOffset, fromWithOffset, relType.color);
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, from: Person, to: Person, color: string) => {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowLength = 8;
    const arrowWidth = 6;

    // Calculate arrow position (at edge of node)
    const arrowX = to.x - Math.cos(angle) * (nodeRadius + 5);
    const arrowY = to.y - Math.sin(angle) * (nodeRadius + 5);

    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowLength, -arrowWidth);
    ctx.lineTo(-arrowLength, arrowWidth);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  // Input sanitization helper
  const sanitizeName = (name: string): string => {
    return name
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
      .substring(0, 50); // Limit to 50 characters
  };

  // Helper function to get relationship type details (predefined or custom)
  const getRelationshipTypeDetails = (relationship: Relationship) => {
    if (relationship.type === 'custom' && relationship.customLabel) {
      return {
        value: 'custom',
        label: relationship.customLabel,
        description: relationship.customLabel,
        color: '#6366f1', // Default custom color
        pattern: relationship.customPattern || 'solid'
      };
    }
    return relationshipTypes.find(rt => rt.value === relationship.type);
  };

  const addPerson = () => {
    const sanitizedName = sanitizeName(newPersonName);
    
    if (!sanitizedName) {
      toast({ title: "Please enter a valid name" });
      return;
    }

    if (sanitizedName.length > 50) {
      toast({ title: "Name must be 50 characters or less" });
      return;
    }

    if (people.some(p => p.name.toLowerCase() === sanitizedName.toLowerCase())) {
      toast({ title: "Person with this name already exists" });
      return;
    }

    const newPerson: Person = {
      id: Date.now().toString(),
      name: sanitizedName,
      x: Math.random() * (canvasSize.width - 100) + 50,
      y: Math.random() * (canvasSize.height - 100) + 50,
      color: nodeColors[people.length % nodeColors.length]
    };

    setPeople(prev => [...prev, newPerson]);
    setNewPersonName('');
    toast({ title: `Added ${newPerson.name} to the map` });
  };

  const exportData = () => {
    const data = { people, relationships };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'polycule-map.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Map exported successfully" });
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Simple file size limit (1MB)
    if (file.size > 1024 * 1024) {
      toast({ title: "File too large (max 1MB)", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Simple validation - check structure and types
        if (!data.people || !data.relationships || !Array.isArray(data.people) || !Array.isArray(data.relationships)) {
          toast({ title: "Invalid file format", variant: "destructive" });
          return;
        }

        // Validate people structure
        const validPeople = data.people.every((person: any) => 
          person.id && person.name && typeof person.x === 'number' && typeof person.y === 'number'
        );

        if (!validPeople) {
          toast({ title: "Invalid people data format", variant: "destructive" });
          return;
        }

        setPeople(data.people);
        setRelationships(data.relationships);
        toast({ title: "Map imported successfully" });
      } catch (error) {
        toast({ title: "Error reading file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const addRelationship = () => {
    if (!selectedFrom || !selectedTo || selectedFrom === selectedTo) {
      toast({ title: "Please select two different people" });
      return;
    }

    if (selectedRelType === 'custom' && !customLabel.trim()) {
      toast({ title: "Please enter a custom relationship label" });
      return;
    }

    // Check if relationship already exists
    const exists = relationships.some(rel => 
      (rel.from === selectedFrom && rel.to === selectedTo) ||
      (rel.from === selectedTo && rel.to === selectedFrom)
    );

    if (exists) {
      toast({ title: "Relationship already exists between these people" });
      return;
    }

    const sanitizedCustomLabel = selectedRelType === 'custom' ? sanitizeName(customLabel) : undefined;

    const newRelationship: Relationship = {
      id: Date.now().toString(),
      from: selectedFrom,
      to: selectedTo,
      type: selectedRelType,
      customLabel: sanitizedCustomLabel,
      customPattern: selectedRelType === 'custom' ? customPattern : undefined
    };

    setRelationships(prev => [...prev, newRelationship]);
    setSelectedFrom('');
    setSelectedTo('');
    
    // Reset custom fields
    if (selectedRelType === 'custom') {
      setCustomLabel('');
      setCustomPattern('solid');
    }
    
    const fromName = people.find(p => p.id === selectedFrom)?.name;
    const toName = people.find(p => p.id === selectedTo)?.name;
    const relationshipLabel = selectedRelType === 'custom' 
      ? sanitizedCustomLabel 
      : relationshipTypes.find(rt => rt.value === selectedRelType)?.label;
    
    toast({ title: `Added ${relationshipLabel} relationship between ${fromName} and ${toName}` });
  };

  const removeRelationship = (id: string) => {
    setRelationships(prev => prev.filter(rel => rel.id !== id));
  };

  const removePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setRelationships(prev => prev.filter(rel => rel.from !== id && rel.to !== id));
  };

  const resetView = () => {
    setPanOffset({ x: 0, y: 0 });
    setZoomLevel(1.0);
    toast({ title: "View reset to center" });
  };

  const zoomIn = () => {
    const newZoomLevel = Math.min(3.0, zoomLevel * 1.2);
    setZoomLevel(newZoomLevel);
    toast({ title: `Zoomed to ${Math.round(newZoomLevel * 100)}%` });
  };

  const zoomOut = () => {
    const newZoomLevel = Math.max(0.5, zoomLevel / 1.2);
    setZoomLevel(newZoomLevel);
    toast({ title: `Zoomed to ${Math.round(newZoomLevel * 100)}%` });
  };

  // Helper function to calculate distance between two touch points
  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Helper function to get coordinates from mouse or touch event
  const getEventCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX: number, clientY: number;
    
    if ('touches' in e && e.touches.length > 0) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return null;
    }
    
    const x = ((clientX - rect.left) * scaleX / (window.devicePixelRatio || 1) - panOffset.x) / zoomLevel;
    const y = ((clientY - rect.top) * scaleY / (window.devicePixelRatio || 1) - panOffset.y) / zoomLevel;
    
    return { x, y };
  };

  // Canvas mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getEventCoordinates(e);
    if (!coords) return;

    for (const person of people) {
      const dist = Math.sqrt((coords.x - person.x) ** 2 + (coords.y - person.y) ** 2);
      if (dist < nodeRadius / zoomLevel) { // Account for zoom level in hit detection
        setIsDragging(true);
        setDraggedPerson(person);
        break;
      }
    }
  };

  // Canvas touch events
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling

    // Handle pinch zoom (two fingers)
    if (e.touches.length === 2 && isMobile) {
      setIsZooming(true);
      setLastZoomDistance(getTouchDistance(e.touches));
      return;
    }

    // Handle single touch
    if (e.touches.length === 1) {
      const coords = getEventCoordinates(e);
      if (!coords) return;

      // Check if touching a person node
      let foundPerson = false;
      for (const person of people) {
        const dist = Math.sqrt((coords.x - person.x) ** 2 + (coords.y - person.y) ** 2);
        if (dist < nodeRadius * zoomLevel) { // Account for zoom level in hit detection
          setIsDragging(true);
          setDraggedPerson(person);
          foundPerson = true;
          break;
        }
      }

      // If not touching a person and on mobile, start panning
      if (!foundPerson && isMobile) {
        setIsPanning(true);
        const touch = e.touches[0];
        setLastPanPoint({ x: touch.clientX, y: touch.clientY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !draggedPerson) return;

    const coords = getEventCoordinates(e);
    if (!coords) return;

    // Use logical canvas dimensions for constraints, accounting for pan offset and zoom
    const x = Math.max((nodeRadius - panOffset.x) / zoomLevel, Math.min((canvasSize.width - nodeRadius - panOffset.x) / zoomLevel, coords.x));
    const y = Math.max((nodeRadius - panOffset.y) / zoomLevel, Math.min((canvasSize.height - nodeRadius - panOffset.y) / zoomLevel, coords.y));

    setPeople(prev => prev.map(p => 
      p.id === draggedPerson.id ? { ...p, x, y } : p
    ));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling
    
    // Handle pinch zoom (two fingers)
    if (e.touches.length === 2 && isZooming && isMobile) {
      const currentDistance = getTouchDistance(e.touches);
      if (lastZoomDistance > 0) {
        const zoomFactor = currentDistance / lastZoomDistance;
        const newZoomLevel = Math.max(0.5, Math.min(3.0, zoomLevel * zoomFactor));
        setZoomLevel(newZoomLevel);
      }
      setLastZoomDistance(currentDistance);
      return;
    }
    
    if (isDragging && draggedPerson && e.touches.length === 1) {
      // Handle node dragging
      const coords = getEventCoordinates(e);
      if (!coords) return;

      // Use logical canvas dimensions for constraints, accounting for pan offset and zoom
      const x = Math.max((nodeRadius - panOffset.x) / zoomLevel, Math.min((canvasSize.width - nodeRadius - panOffset.x) / zoomLevel, coords.x));
      const y = Math.max((nodeRadius - panOffset.y) / zoomLevel, Math.min((canvasSize.height - nodeRadius - panOffset.y) / zoomLevel, coords.y));

      setPeople(prev => prev.map(p => 
        p.id === draggedPerson.id ? { ...p, x, y } : p
      ));
    } else if (isPanning && isMobile && e.touches.length === 1) {
      // Handle canvas panning
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastPanPoint.x;
      const deltaY = touch.clientY - lastPanPoint.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedPerson(null);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setDraggedPerson(null);
    setIsPanning(false);
    setIsZooming(false);
    setLastZoomDistance(0);
  };

  useEffect(() => {
    drawNetwork();
  }, [drawNetwork]);

  return (
    <div className={`w-full max-w-7xl mx-auto space-y-6 ${isMobile ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Heart className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Poly Relationship Mapper
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Visualize your polycule connections in an interactive network map
        </p>
      </div>

      {/* Export/Import Controls */}
      <div className="flex justify-center gap-4 mb-6">
        <Button onClick={exportData} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Map
        </Button>
        <div className="relative">
          <input
            type="file"
            accept=".json"
            onChange={importData}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            id="import-file"
          />
          <Button variant="outline" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Map
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
        {/* Add Person */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Add Person
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter person's name"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPerson()}
                className="flex-1"
              />
              <Button onClick={addPerson} variant="gradient">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {people.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">People in your map:</p>
                <div className="flex flex-wrap gap-1">
                  {people.map(person => (
                    <Badge 
                      key={person.id} 
                      variant="secondary" 
                      className="flex items-center gap-1"
                      style={{ backgroundColor: person.color + '20', color: person.color }}
                    >
                      {person.name}
                      <button onClick={() => removePerson(person.id)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Relationship */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle>Add Relationship</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {people.length < 2 ? (
              <p className="text-muted-foreground text-sm">Add at least 2 people to create relationships</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={selectedFrom} onValueChange={setSelectedFrom}>
                    <SelectTrigger>
                      <SelectValue placeholder="From" />
                    </SelectTrigger>
                    <SelectContent>
                      {people.map(person => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedTo} onValueChange={setSelectedTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="To" />
                    </SelectTrigger>
                    <SelectContent>
                      {people.filter(p => p.id !== selectedFrom).map(person => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Select value={selectedRelType} onValueChange={(value: RelationshipType) => setSelectedRelType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {relationshipTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedRelType === 'custom' && (
                  <div className="space-y-3">
                    <Input
                      placeholder="Enter custom relationship type (e.g., Co-parents)"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      maxLength={30}
                    />
                    <Select value={customPattern} onValueChange={(value: 'solid' | 'dashed' | 'dotted') => setCustomPattern(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Line Style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid Line</SelectItem>
                        <SelectItem value="dashed">Dashed Line</SelectItem>
                        <SelectItem value="dotted">Dotted Line</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button 
                  onClick={addRelationship} 
                  className="w-full" 
                  variant="gradient"
                  disabled={selectedRelType === 'custom' && !customLabel.trim()}
                >
                  Add Relationship
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Canvas */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Polycule Map</CardTitle>
            {isMobile && (
              <div className="flex gap-2">
                <Button onClick={zoomOut} variant="outline" size="sm">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button onClick={zoomIn} variant="outline" size="sm">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button onClick={resetView} variant="outline" size="sm" className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isMobile 
              ? "Touch and drag people to move them. Touch and drag empty space to pan the view. Use pinch gestures to zoom in/out."
              : "Drag people around to arrange your network. Click and drag the colored circles to move people."
            }
          </p>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-hidden rounded-lg bg-background border">
            <canvas
              ref={canvasRef}
              className="w-full cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ display: 'block', touchAction: 'none' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle>Relationship Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {relationshipTypes.map(type => (
              <div key={type.value} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-8 h-0.5 ${type.pattern === 'dashed' ? 'border-t-2 border-dashed' : type.pattern === 'dotted' ? 'border-t-2 border-dotted' : 'border-t-2'}`}
                    style={{ borderColor: type.color }}
                  />
                  <div className="w-2 h-2 rotate-45 border-t-2 border-r-2" style={{ borderColor: type.color }} />
                </div>
                <div>
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Relationships */}
      {relationships.length > 0 && (
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle>Current Relationships</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relationships.map(rel => {
                const fromPerson = people.find(p => p.id === rel.from);
                const toPerson = people.find(p => p.id === rel.to);
                const relType = getRelationshipTypeDetails(rel);
                
                return (
                  <div key={rel.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fromPerson?.name}</span>
                      <span className="text-muted-foreground">↔</span>
                      <span className="font-medium">{toPerson?.name}</span>
                      <Badge variant="outline" style={{ color: relType?.color }}>
                        {relType?.label}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRelationship(rel.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};