# DivineAcquisition Hiring Page - Design Specification

This document outlines the exact design components to replicate from https://hiring.clientacquisition.io/ for the DivineAcquisition hiring page.

---

## 1. Overall Theme & Style

### Color Palette
| Element | Color | CSS Value |
|---------|-------|-----------|
| Background | Pure Black | `#000000` / `bg-black` |
| Primary Accent | Emerald Green | `#34d399` / `emerald-400/500` |
| Text Primary | White | `#ffffff` / `text-white` |
| Text Secondary | Neutral Gray | `text-neutral-300`, `text-neutral-400`, `text-neutral-500` |
| Borders | White with opacity | `border-white/5`, `border-white/10` |
| Selection | Emerald tinted | `selection:bg-emerald-900/50 selection:text-emerald-50` |

### Typography
- **Primary Font**: `Geist` (sans-serif)
- **Fallback Fonts**: Inter, system-ui, sans-serif
- **Font Weights**: 300 (light), 400 (normal), 500 (medium), 600 (semibold)
- **Tracking**: `tracking-tight`, `tracking-tighter` for headings

### Design Characteristics
- Dark mode design (`class="dark"`)
- Smooth scrolling (`scroll-smooth`)
- Antialiased text rendering
- Glassmorphism effects with backdrop blur
- Subtle glow effects using emerald accent color

---

## 2. Background Effects

### Gradient Overlays
```html
<!-- Fixed background container -->
<div class="fixed inset-0 -z-10 h-full w-full pointer-events-none">
  <!-- Top Green Glow - Large elliptical gradient from top -->
  <div class="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(52,211,153,0.35),rgba(0,0,0,0))]"></div>
  
  <!-- Bottom/Right Secondary Glow -->
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.2),rgba(0,0,0,0))]"></div>
</div>
```

---

## 3. Navigation Bar

### Structure
- Fixed position at top (`fixed top-0 left-0 right-0 z-50`)
- Height: 80px (`h-20`)
- Bottom border: `border-b border-white/5`
- Background: Semi-transparent with blur (`bg-black/10 backdrop-blur-xl`)
- Max width container: `max-w-[1800px] mx-auto`
- Horizontal padding: `px-6 md:px-8`

### Components
1. **Logo** (left side)
   - Image with hover opacity transition
   - Height: 28px (`h-7`)
   
2. **CTA Button** (right side)
   - Style: Rounded full pill (`rounded-full`)
   - Background: `bg-white/10` with hover to solid white
   - Border: `border border-white/10`
   - Padding: `px-6 py-2.5`
   - Font: `text-xs font-medium`
   - Hover effects: translate up, shadow glow
   - Icon: Arrow pointing down-right

3. **Mobile Menu** (hamburger icon for mobile)

### Button CSS
```css
/* CTA Button hover state */
.cta-button:hover {
  background: white;
  color: black;
  box-shadow: 0 0 25px -5px rgba(255,255,255,0.2);
  transform: translateY(-2px);
}
```

---

## 4. Hero Section

### Layout
- Full width with padding: `px-6 md:px-8`
- Vertical padding: `py-32 md:py-40`
- Top padding accounts for fixed nav: `pt-32`
- Text centered: `text-center`
- Max content width: `max-w-4xl mx-auto`
- Bottom margin: `mb-24`

### Components

#### 4.1 Status Badge
```html
<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium 
            text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 mb-10 
            shadow-[0_0_20px_-5px_rgba(52,211,153,0.3)]">
  <!-- Animated ping dot -->
  <span class="relative flex h-1.5 w-1.5">
    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
    <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
  </span>
  Recruiting Top 1% Talent
</div>
```

#### 4.2 Main Headline
```html
<h1 class="text-5xl md:text-8xl font-medium text-white tracking-tighter mb-8 
           leading-[0.9] drop-shadow-lg">
  Build the engine of
  <br class="hidden md:block">
  <span class="text-transparent bg-clip-text bg-gradient-to-br 
               from-white via-emerald-200 to-emerald-400">
    autonomous revenue.
  </span>
</h1>
```

#### 4.3 Subheadline
```html
<p class="text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed font-light tracking-tight">
  We are building <span class="text-white font-medium">ProductName</span>, 
  description text here...
</p>
```

#### 4.4 Scroll Indicator
```html
<div class="mt-24 flex justify-center w-full">
  <a href="#open-roles" class="flex items-center justify-center text-neutral-300 
     transition-all duration-300 animate-bounce p-3 rounded-full bg-white/5 
     border border-white/10 backdrop-blur-sm 
     shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)] 
     hover:text-emerald-300 hover:border-emerald-400/50 
     hover:bg-emerald-400/10 hover:shadow-[0_0_20px_-5px_rgba(52,211,153,0.3)]">
    <iconify-icon icon="lucide:arrow-down" width="32" height="32"></iconify-icon>
  </a>
</div>
```

### Fade-in Animation
```css
.fade-enter {
  animation: fadeEnter 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  opacity: 0;
  transform: translateY(15px);
}

@keyframes fadeEnter {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 5. Main Content Layout

### Grid Structure
```html
<main class="w-full px-6 md:px-8 pb-12 md:pb-20 scroll-mt-24" id="open-roles">
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
    <!-- Sidebar: 3 columns on large screens -->
    <aside class="lg:col-span-3 lg:sticky lg:top-28 h-fit">
      <!-- Filter content -->
    </aside>
    
    <!-- Job listings: 9 columns on large screens -->
    <div class="lg:col-span-9 space-y-12">
      <!-- Job sections -->
    </div>
  </div>
</main>
```

---

## 6. Sidebar Filters

### Container Style
```html
<div class="bg-neutral-900/40 backdrop-blur-2xl border border-white/10 
            rounded-2xl p-6 shadow-xl shadow-emerald-900/10">
```

### Section Headers
```html
<h3 class="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
  Department
</h3>
```

### Department Filter Buttons
```html
<!-- Active state -->
<button class="w-full text-left px-3 py-2 rounded-md bg-white text-black 
               text-sm font-medium flex justify-between items-center group shadow-sm">
  View All
  <span class="text-[10px] px-1.5 py-0.5 rounded-full text-black/60 bg-black/5">11</span>
</button>

<!-- Inactive state -->
<button class="w-full text-left px-3 py-2 rounded-md text-neutral-400 
               hover:text-white hover:bg-white/5 text-sm transition-all 
               flex justify-between items-center group font-light">
  Engineering
  <span class="text-[10px] px-1.5 py-0.5 rounded-full text-neutral-400 bg-white/5 
               group-hover:text-white group-hover:bg-white/10">3</span>
</button>
```

### Location Checkboxes
```html
<label class="custom-checkbox flex items-center gap-3 cursor-pointer group select-none">
  <input type="checkbox" class="peer sr-only" checked value="remote">
  <div class="relative flex items-center justify-center w-4 h-4 
              border border-neutral-600 rounded bg-transparent 
              transition-all duration-200 group-hover:border-emerald-500">
    <iconify-icon icon="solar:check-read-linear" 
                  class="text-black opacity-0 transition-all duration-200 text-xs">
    </iconify-icon>
  </div>
  <span class="text-sm font-light text-neutral-400 group-hover:text-white transition-colors">
    Remote
  </span>
</label>
```

### Checkbox Checked State CSS
```css
.custom-checkbox input:checked + div {
  background-color: #34d399;
  border-color: #34d399;
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.4);
}
.custom-checkbox input:checked + div iconify-icon {
  opacity: 1;
  transform: scale(1);
}
```

### Sort Dropdown
```html
<div class="relative group">
  <select class="w-full bg-white/5 border border-white/10 text-neutral-300 text-sm 
                 rounded-xl focus:ring-1 focus:ring-emerald-500/50 
                 focus:border-emerald-500/50 block py-3 pl-4 pr-10 
                 appearance-none cursor-pointer hover:bg-white/10 
                 transition-all outline-none font-light shadow-sm backdrop-blur-md">
    <option value="level-desc">Level: High to Low</option>
    <option value="level-asc">Level: Low to High</option>
    <option value="date-new">Date: Newest First</option>
    <option value="date-old">Date: Oldest First</option>
  </select>
  <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 
              text-neutral-500 group-hover:text-emerald-400 transition-colors">
    <iconify-icon icon="solar:sort-vertical-linear" width="16"></iconify-icon>
  </div>
</div>
```

---

## 7. Job Section Headers

```html
<h2 class="text-lg font-medium text-white tracking-tight mb-6 flex items-center gap-3">
  <span class="w-8 h-8 rounded-full bg-white/5 border border-white/5 
               flex items-center justify-center text-emerald-500">
    <iconify-icon icon="lucide:code-2" width="18" height="18"></iconify-icon>
  </span>
  Engineering
</h2>
```

### Section Icons by Department
| Department | Icon |
|------------|------|
| Engineering | `lucide:code-2` |
| Growth & Marketing | `lucide:trending-up` |
| Sales | `lucide:users` |
| Client Success | `lucide:heart-handshake` |

---

## 8. Job Cards

### Card Grid Layout
```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  <!-- Job cards -->
</div>
```

### Card Structure
```html
<a href="/job-slug" class="job-card block group overflow-hidden 
   bg-[#0a0a0a]/80 border-white/10 border rounded-xl 
   pt-6 pr-6 pb-6 pl-6 relative shadow-2xl backdrop-blur-sm"
   data-dept="engineering" data-loc="remote" data-level="4" data-date="2026-01-19">
  
  <div class="flex flex-col h-full justify-between gap-8">
    <!-- Content section -->
    <div>
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-base font-medium text-white group-hover:text-emerald-400 transition-colors">
          Job Title Here
        </h3>
        <iconify-icon icon="solar:arrow-right-up-linear" 
                      class="text-neutral-600 group-hover:text-emerald-400 transition-colors" 
                      width="20" height="20"></iconify-icon>
      </div>
      <p class="text-sm text-neutral-400 font-light line-clamp-2">
        Job description limited to 2 lines...
      </p>
    </div>
    
    <!-- Meta section -->
    <div class="flex items-center gap-4 text-xs text-neutral-500 font-medium">
      <!-- Location -->
      <span class="flex items-center gap-1.5 group-hover:text-emerald-500/80 transition-colors">
        <iconify-icon icon="solar:map-point-linear" width="14" height="14"></iconify-icon>
        Remote
      </span>
      
      <!-- Level indicator -->
      <span class="flex items-center gap-1.5 group-hover:text-emerald-500/80 transition-colors">
        <div class="flex gap-0.5">
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <div class="w-1.5 h-1.5 rounded-full bg-white/10"></div>
        </div>
        Senior
      </span>
      
      <!-- Date -->
      <span class="flex items-center gap-1.5 group-hover:text-neutral-400 transition-colors ml-auto">
        <iconify-icon icon="solar:calendar-linear" width="14" height="14"></iconify-icon>
        May 19, 2026
      </span>
    </div>
  </div>
</a>
```

### Card CSS Styles
```css
.job-card {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  background-color: rgba(255, 255, 255, 0.02) !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(10px);
}

.job-card:hover {
  transform: translateY(-4px);
  background-color: rgba(255, 255, 255, 0.04) !important;
  border-color: rgba(52, 211, 153, 0.6) !important;
  box-shadow: 0 20px 40px -10px rgba(52, 211, 153, 0.2);
}

/* Emerald dot glow */
.job-card .bg-emerald-500 {
  background-color: #34d399 !important;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
}
```

### Level Indicator System
| Level | Dots Filled | Label |
|-------|-------------|-------|
| 1 | 1 of 4 | Entry |
| 2 | 2 of 4 | Mid |
| 3 | 3 of 4 | Senior |
| 4 | 4 of 4 | Lead |

---

## 9. Footer

### Structure
```html
<footer class="z-10 border-white/10 border-t mt-auto pt-16 pb-16 relative">
  <div class="w-full px-6 md:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
    <!-- Left: Logo + Copyright -->
    <div class="flex items-center gap-3">
      <img src="logo-url" alt="Logo" class="h-6 w-auto object-contain opacity-70">
      <span class="text-neutral-500 font-medium text-sm tracking-tight">
        © 2026 DivineAcquisition
      </span>
    </div>
    
    <!-- Right: Links -->
    <div class="flex items-center gap-8">
      <a href="#" class="text-xs text-neutral-500 hover:text-emerald-400 transition-colors">
        Instagram
      </a>
      <a href="#" class="text-xs text-neutral-500 hover:text-emerald-400 transition-colors">
        Twitter
      </a>
      <a href="#" class="text-xs text-neutral-500 hover:text-emerald-400 transition-colors">
        Privacy
      </a>
      <a href="#" class="text-xs text-neutral-500 hover:text-emerald-400 transition-colors">
        Terms
      </a>
    </div>
  </div>
</footer>
```

---

## 10. Custom Scrollbar

```css
::-webkit-scrollbar {
  width: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #444;
}
```

---

## 11. Icon Library

Uses **Iconify** for icons with two main icon sets:
- **Solar Icons** (`solar:*`) - Modern line icons
- **Lucide Icons** (`lucide:*`) - Feather-style icons

### Key Icons Used
| Usage | Icon |
|-------|------|
| Arrow CTA | `solar:arrow-right-down-linear` |
| Arrow Card | `solar:arrow-right-up-linear` |
| Location | `solar:map-point-linear` |
| Calendar | `solar:calendar-linear` |
| Checkbox | `solar:check-read-linear` |
| Sort | `solar:sort-vertical-linear` |
| Scroll Down | `lucide:arrow-down` |
| Mobile Menu | `solar:hamburger-menu-linear` |

### Include Iconify
```html
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
```

---

## 12. Dependencies

### CSS Framework
- **Tailwind CSS** via CDN: `https://cdn.tailwindcss.com`

### Fonts
- **Geist** (primary): `https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap`
- **Inter** (fallback): `https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap`

### Icons
- **Iconify**: `https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js`

---

## 13. Data Attributes for Filtering

### Job Card Data Attributes
```html
data-dept="engineering"    <!-- Department filter -->
data-loc="remote"          <!-- Location filter -->
data-level="3"             <!-- Seniority level (1-4) -->
data-date="2026-01-19"     <!-- Posted date for sorting -->
```

### Department Values
- `all` - View All
- `engineering`
- `growth-marketing`
- `sales`
- `client-success`

### Location Values
- `remote`
- `montreal` (or other locations)

---

## 14. Responsive Breakpoints

| Breakpoint | Tailwind | Changes |
|------------|----------|---------|
| Mobile | Default | Single column, smaller text |
| Medium | `md:` | 2-column job grid, larger hero text |
| Large | `lg:` | 12-column grid layout, sticky sidebar |

---

## 15. Animation Stagger Pattern

Apply incrementing `animation-delay` to staggered elements:
```html
<div class="fade-enter" style="animation-delay: 0s">Hero</div>
<aside class="fade-enter" style="animation-delay: 0.1s">Sidebar</aside>
<div class="fade-enter" style="animation-delay: 0.2s">Job listings</div>
```

---

## Summary Checklist

- [ ] Dark theme with pure black background
- [ ] Emerald (#34d399) accent color
- [ ] Geist font family
- [ ] Radial gradient glows from top and bottom-right
- [ ] Fixed navigation with glassmorphism
- [ ] Animated status badge with ping effect
- [ ] Gradient text headline
- [ ] Bouncing scroll indicator
- [ ] Sticky sidebar with filters
- [ ] Glassmorphism filter container
- [ ] Department filter buttons
- [ ] Custom checkbox styling
- [ ] Dropdown select with custom arrow
- [ ] Section headers with icons
- [ ] Glassmorphism job cards
- [ ] Hover lift effect on cards
- [ ] Level indicator dots
- [ ] Footer with social links
- [ ] Custom slim scrollbar
- [ ] Fade-in entry animations
- [ ] Mobile responsive design
