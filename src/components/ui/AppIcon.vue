<template>
  <component :is="resolved" :size="size" :stroke-width="strokeWidth" :class="$attrs.class" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Activity, AlertTriangle, AppWindow, Archive, ArrowDown, ArrowUp, Backpack, Baby, BarChart3,
  Bell, BookOpen, Building2, Calculator, Calendar, Castle, Check, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, ChevronsUpDown, CircleCheck, CircleDot, CircleHelp, CircleX, Clock,
  Coins, Copy, Crown, Database, Delete, Dices, Download, Dumbbell, Ellipsis, EllipsisVertical, ExternalLink,
  Eye, Feather, FileText, Filter, FlaskConical, Folder, FolderOpen, FolderPlus, Gamepad2, Gem, Gift,
  Grip, GripVertical, Hand, HardDrive, Heart, History, Home, Image, Info, Layers, LayoutGrid,
  Lightbulb, Link2, List, LoaderCircle, Lock, LockOpen, Map, Maximize, MessageSquare, Minimize,
  Moon, MousePointerClick, Move, Package, Palette, Pencil, Percent, Pill, Play, Plus, RotateCw,
  Save, ScrollText, Search, Send, Settings, Shield, ShoppingBag, ShoppingCart, SlidersHorizontal,
  RefreshCw, Rocket, Sparkles, SquarePen, Star, Store, Sun, Swords, Target, Terminal, Timer, Trash2, TrendingDown,
  TrendingUp, Unlock, Upload, User, Users, Wand2, Wrench, X, Zap, ZoomIn, ZoomOut, Ghost, Bird, Globe,
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  icon: string
  size?: number
  strokeWidth?: number
}>(), {
  size: 14,
  strokeWidth: 2,
})

const MAP: Record<string, unknown> = {
  'activity': Activity, 'alert': AlertTriangle, 'app-window': AppWindow, 'archive': Archive,
  'arrow-down': ArrowDown, 'arrow-up': ArrowUp, 'backpack': Backpack, 'baby': Baby,
  'chart': BarChart3, 'bell': Bell, 'book': BookOpen, 'building': Building2,
  'calculator': Calculator, 'calendar': Calendar, 'castle': Castle, 'check': Check,
  'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  'chevron-up': ChevronUp, 'chevrons-up-down': ChevronsUpDown, 'circle-check': CircleCheck,
  'circle-dot': CircleDot, 'help': CircleHelp, 'circle-x': CircleX, 'clock': Clock,
  'coins': Coins, 'copy': Copy, 'crown': Crown, 'database': Database, 'delete': Delete, 'dices': Dices,
  'download': Download, 'dumbbell': Dumbbell, 'ellipsis': Ellipsis, 'ellipsis-v': EllipsisVertical,
  'external-link': ExternalLink, 'eye': Eye, 'feather': Feather, 'file-text': FileText,
  'filter': Filter, 'flask': FlaskConical, 'folder': Folder, 'folder-open': FolderOpen,
  'folder-plus': FolderPlus, 'gamepad': Gamepad2, 'gem': Gem, 'gift': Gift, 'grip': Grip,
  'grip-v': GripVertical, 'hand': Hand, 'hard-drive': HardDrive, 'heart': Heart, 'history': History,
  'home': Home, 'image': Image, 'info': Info, 'layers': Layers, 'grid': LayoutGrid,
  'lightbulb': Lightbulb, 'link': Link2, 'list': List, 'loader': LoaderCircle, 'lock': Lock,
  'unlock': LockOpen, 'map': Map, 'maximize': Maximize, 'message': MessageSquare,
  'minimize': Minimize, 'moon': Moon, 'mouse-pointer': MousePointerClick, 'move': Move,
  'package': Package, 'palette': Palette, 'pencil': Pencil, 'percent': Percent, 'pill': Pill,
  'play': Play, 'plus': Plus, 'refresh': RefreshCw, 'rotate': RotateCw, 'rocket': Rocket, 'save': Save, 'scroll': ScrollText,
  'search': Search, 'send': Send, 'settings': Settings, 'shield': Shield, 'bag': ShoppingBag,
  'cart': ShoppingCart, 'sliders': SlidersHorizontal, 'sparkles': Sparkles, 'edit': SquarePen,
  'star': Star, 'store': Store, 'sun': Sun, 'swords': Swords, 'target': Target,
  'terminal': Terminal, 'timer': Timer, 'trash': Trash2, 'trending-up': TrendingUp,
  'trending-down': TrendingDown, 'upload': Upload, 'user': User, 'users': Users, 'wand': Wand2, 'wrench': Wrench,
  'x': X, 'zap': Zap, 'zoom-in': ZoomIn, 'zoom-out': ZoomOut, 'ghost': Ghost,
  'bird': Bird,
  'globe': Globe,
}

const resolved = computed(() => {
  const comp = MAP[props.icon]
  if (!comp) {
    console.warn(`[AppIcon] 未注册的图标名: "${props.icon}"`)
    return CircleDot
  }
  return comp
})
</script>
