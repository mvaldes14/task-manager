import {
  Folder, Inbox, Star, Heart,
  Briefcase, Building2, Users, Target, ClipboardList, CalendarDays, Mail, Phone,
  DollarSign, CreditCard, ShoppingCart,
  Home, Hammer, Wrench, Shirt, Package, Car,
  Utensils, Coffee,
  HeartPulse, Pill, Dumbbell,
  GraduationCap, BookOpen, FlaskConical, Lightbulb,
  Palette, Camera, Music, Film,
  Code, Terminal, Server, Monitor,
  Plane, Globe, Mountain, Leaf, Sprout,
  PawPrint, Gamepad2, Trophy, Rocket, Zap, Smile, Shield
} from 'lucide-react'

// NOTE: `name` is the value persisted on projects.icon. Never rename or remove an
// entry — array order is cosmetic, but the name string is the storage key.
export const PROJECT_ICON_OPTIONS = [
  // general
  { name: 'folder',    Icon: Folder },
  { name: 'inbox',     Icon: Inbox },
  { name: 'star',      Icon: Star },
  { name: 'heart',     Icon: Heart },
  // work
  { name: 'briefcase', Icon: Briefcase },
  { name: 'building',  Icon: Building2 },
  { name: 'users',     Icon: Users },
  { name: 'target',    Icon: Target },
  { name: 'clipboard', Icon: ClipboardList },
  { name: 'calendar',  Icon: CalendarDays },
  { name: 'mail',      Icon: Mail },
  { name: 'phone',     Icon: Phone },
  // money
  { name: 'dollar',    Icon: DollarSign },
  { name: 'card',      Icon: CreditCard },
  { name: 'cart',      Icon: ShoppingCart },
  // home & errands
  { name: 'home',      Icon: Home },
  { name: 'hammer',    Icon: Hammer },
  { name: 'wrench',    Icon: Wrench },
  { name: 'shirt',     Icon: Shirt },
  { name: 'package',   Icon: Package },
  { name: 'car',       Icon: Car },
  // food
  { name: 'utensils',  Icon: Utensils },
  { name: 'coffee',    Icon: Coffee },
  // health
  { name: 'pulse',     Icon: HeartPulse },
  { name: 'pill',      Icon: Pill },
  { name: 'dumbbell',  Icon: Dumbbell },
  // learning
  { name: 'graduation',Icon: GraduationCap },
  { name: 'book',      Icon: BookOpen },
  { name: 'flask',     Icon: FlaskConical },
  { name: 'bulb',      Icon: Lightbulb },
  // creative
  { name: 'palette',   Icon: Palette },
  { name: 'camera',    Icon: Camera },
  { name: 'music',     Icon: Music },
  { name: 'film',      Icon: Film },
  // tech
  { name: 'code',      Icon: Code },
  { name: 'terminal',  Icon: Terminal },
  { name: 'server',    Icon: Server },
  { name: 'monitor',   Icon: Monitor },
  // travel & outdoors
  { name: 'plane',     Icon: Plane },
  { name: 'globe',     Icon: Globe },
  { name: 'mountain',  Icon: Mountain },
  { name: 'leaf',      Icon: Leaf },
  { name: 'sprout',    Icon: Sprout },
  // life & play
  { name: 'paw',       Icon: PawPrint },
  { name: 'gamepad',   Icon: Gamepad2 },
  { name: 'trophy',    Icon: Trophy },
  { name: 'rocket',    Icon: Rocket },
  { name: 'zap',       Icon: Zap },
  { name: 'smile',     Icon: Smile },
  { name: 'shield',    Icon: Shield },
]

const ICON_MAP = Object.fromEntries(PROJECT_ICON_OPTIONS.map(({ name, Icon }) => [name, Icon]))

export function ProjectIcon({ icon, size = 14, className = '' }) {
  const Icon = ICON_MAP[icon] || Folder
  return <Icon size={size} className={className} />
}
