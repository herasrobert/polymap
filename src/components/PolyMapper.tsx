import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, Heart, Download, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
}

export type RelationshipType = 
  | 'committed-nesting'
  | 'committed' 
  | 'budding'
  | 'sexual'
  | 'platonic'
  | 'queer-platonic'
  | 'partner'
  | 'play';

const relationshipTypes: { value: RelationshipType; label: string; description: string; color: string; pattern: string }[] = [
  { value: 'committed-nesting', label: 'Committed Partnership - Nesting', description: 'Living together committed relationship', color: '#3b82f6', pattern: 'solid' },
  { value: 'committed', label: 'Committed Partnership', description: 'Committed romantic relationship', color: '#3b82f6', pattern: 'dashed' },
  { value: 'budding', label: 'Budding Romantic', description: 'New or developing romantic connection', color: '#3b82f6', pattern: 'dotted' },
  { value: 'sexual', label: 'Sexual Partnership', description: 'Primarily sexual relationship', color: '#1f2937', pattern: 'dashed' },
  { value: 'platonic', label: 'Platonic Friendship', description: 'Close platonic friend', color: '#6b7280', pattern: 'dashed' },
  { value: 'queer-platonic', label: 'Queer Platonic', description: 'Queer platonic partnership', color: '#8b5cf6', pattern: 'solid' },
  { value: 'partner', label: 'Partner', description: 'General partnership', color: '#ec4899', pattern: 'solid' },
  { value: 'play', label: 'Play Partner', description: 'Kink/play relationship', color: '#f59e0b', pattern: 'dashed' }
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

  const nodeRadius = 25;

  // Auto-resize canvas
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          const width = Math.min(container.offsetWidth - 40, 1000);
          const height = Math.min(600, window.innerHeight * 0.5);
          setCanvasSize({ width, height });
        }
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

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

    // Draw relationships first (behind nodes)
    relationships.forEach(rel => {
      const fromPerson = people.find(p => p.id === rel.from);
      const toPerson = people.find(p => p.id === rel.to);
      
      if (fromPerson && toPerson) {
        drawRelationship(ctx, fromPerson, toPerson, rel.type);
      }
    });

    // Draw people nodes on top
    people.forEach(person => {
      drawPerson(ctx, person);
    });
  }, [people, relationships, drawRelationship]);

  const drawPerson = (ctx: CanvasRenderingContext2D, person: Person) => {
    // Draw node circle
    ctx.beginPath();
    ctx.arc(person.x, person.y, nodeRadius, 0, Math.PI * 2);
    
    // Gradient fill
    const gradient = ctx.createRadialGradient(person.x, person.y, 0, person.x, person.y, nodeRadius);
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
    ctx.fillText(person.name, person.x, person.y);
  };

  const drawRelationship = (ctx: CanvasRenderingContext2D, from: Person, to: Person, type: RelationshipType) => {
    const relType = relationshipTypes.find(rt => rt.value === type);
    if (!relType) return;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    
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
    drawArrow(ctx, from, to, relType.color);
    drawArrow(ctx, to, from, relType.color);
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

  const addPerson = () => {
    if (!newPersonName.trim()) {
      toast({ title: "Please enter a name" });
      return;
    }

    if (people.some(p => p.name.toLowerCase() === newPersonName.toLowerCase())) {
      toast({ title: "Person with this name already exists" });
      return;
    }

    const newPerson: Person = {
      id: Date.now().toString(),
      name: newPersonName.trim(),
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

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.people && data.relationships) {
          setPeople(data.people);
          setRelationships(data.relationships);
          toast({ title: "Map imported successfully" });
        } else {
          toast({ title: "Invalid file format", variant: "destructive" });
        }
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

    // Check if relationship already exists
    const exists = relationships.some(rel => 
      (rel.from === selectedFrom && rel.to === selectedTo) ||
      (rel.from === selectedTo && rel.to === selectedFrom)
    );

    if (exists) {
      toast({ title: "Relationship already exists between these people" });
      return;
    }

    const newRelationship: Relationship = {
      id: Date.now().toString(),
      from: selectedFrom,
      to: selectedTo,
      type: selectedRelType
    };

    setRelationships(prev => [...prev, newRelationship]);
    setSelectedFrom('');
    setSelectedTo('');
    
    const fromName = people.find(p => p.id === selectedFrom)?.name;
    const toName = people.find(p => p.id === selectedTo)?.name;
    toast({ title: `Added relationship between ${fromName} and ${toName}` });
  };

  const removeRelationship = (id: string) => {
    setRelationships(prev => prev.filter(rel => rel.id !== id));
  };

  const removePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setRelationships(prev => prev.filter(rel => rel.from !== id && rel.to !== id));
  };

  // Canvas mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX / (window.devicePixelRatio || 1);
    const y = (e.clientY - rect.top) * scaleY / (window.devicePixelRatio || 1);

    for (const person of people) {
      const dist = Math.sqrt((x - person.x) ** 2 + (y - person.y) ** 2);
      if (dist < nodeRadius) {
        setIsDragging(true);
        setDraggedPerson(person);
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !draggedPerson) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.max(nodeRadius, Math.min(rect.width - nodeRadius, 
      (e.clientX - rect.left) * scaleX / (window.devicePixelRatio || 1)));
    const y = Math.max(nodeRadius, Math.min(rect.height - nodeRadius, 
      (e.clientY - rect.top) * scaleY / (window.devicePixelRatio || 1)));

    setPeople(prev => prev.map(p => 
      p.id === draggedPerson.id ? { ...p, x, y } : p
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedPerson(null);
  };

  useEffect(() => {
    drawNetwork();
  }, [drawNetwork]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
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
      <div className="grid lg:grid-cols-2 gap-6">
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

                <Button onClick={addRelationship} className="w-full" variant="gradient">
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
          <CardTitle>Your Polycule Map</CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag people around to arrange your network. Click and drag the colored circles to move people.
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
              style={{ display: 'block' }}
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                const relType = relationshipTypes.find(rt => rt.value === rel.type);
                
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