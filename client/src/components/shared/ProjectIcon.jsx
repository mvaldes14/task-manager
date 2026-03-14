import {
  Folder, Home, Briefcase, Target, FlaskConical, BookOpen,
  Palette, Lightbulb, ShoppingCart, Dumbbell, Music, Plane,
  Monitor, Leaf, Rocket, Heart, Star, Zap, Globe, Code,
  Camera, Coffee, Wrench, Shield, Smile
} from 'lucide-react'

export const PROJECT_ICON_OPTIONS = [
  { name: 'folder',   Icon: Folder },
  { name: 'home',     Icon: Home },
  { name: 'briefcase',Icon: Briefcase },
  { name: 'target',   Icon: Target },
  { name: 'flask',    Icon: FlaskConical },
  { name: 'book',     Icon: BookOpen },
  { name: 'palette',  Icon: Palette },
  { name: 'bulb',     Icon: Lightbulb },
  { name: 'cart',     Icon: ShoppingCart },
  { name: 'dumbbell', Icon: Dumbbell },
  { name: 'music',    Icon: Music },
  { name: 'plane',    Icon: Plane },
  { name: 'monitor',  Icon: Monitor },
  { name: 'leaf',     Icon: Leaf },
  { name: 'rocket',   Icon: Rocket },
  { name: 'heart',    Icon: Heart },
  { name: 'star',     Icon: Star },
  { name: 'zap',      Icon: Zap },
  { name: 'globe',    Icon: Globe },
  { name: 'code',     Icon: Code },
  { name: 'camera',   Icon: Camera },
  { name: 'coffee',   Icon: Coffee },
  { name: 'wrench',   Icon: Wrench },
  { name: 'shield',   Icon: Shield },
  { name: 'smile',    Icon: Smile },
]

const ICON_MAP = Object.fromEntries(PROJECT_ICON_OPTIONS.map(({ name, Icon }) => [name, Icon]))

export function ProjectIcon({ icon, size = 14, className = '' }) {
  const Icon = ICON_MAP[icon] || Folder
  return <Icon size={size} className={className} />
}
