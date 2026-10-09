# AIX Table Schemas - Synced with aix-system-prompt.ts

## Creation Order (MANDATORY)

1. `sys_aix_theme` - FIRST
2. `sys_aix_app_shell` - needs theme
3. `sys_aix_experience` - needs app_shell + theme
4. `sys_aix_page_route_map` - ONLY for /home redirect
5. `sys_aix_page` - needs experience
6. `sys_aix_container` - needs page OR app_shell
7. `sys_aix_widget` - component definition
8. `sys_aix_widget_instance` - needs container + widget
9. `sys_aix_menu` - LAST (after pages)
10. `sys_aix_menu_item` - needs menu

---

## 1. sys_aix_theme

**Fields:** name, color_swatch, primary_color, light_logo, dark_logo

```json
{
  "type": "create",
  "table": "sys_aix_theme",
  "data": {
    "name": "Portal Theme",
    "primary_color": "#3B82F6"
  },
  "has_more": true,
  "next_hint": "Create app shell"
}
```

---

## 2. sys_aix_app_shell

**Fields:** name, theme, css, header, footer, menu

```json
{
  "type": "create",
  "table": "sys_aix_app_shell",
  "data": {
    "name": "Portal Shell",
    "theme": "<theme_sys_id>",
    "css": "@scope (sn-aix-app-shell) to (.uxkit-angular-wrapper) { .aix-main { padding: 0; position: relative; } .aix-main sn-aix-page { --tw-shadow: none; box-shadow: none; background: transparent; } .page-container { padding: 0; } .chat-container { display: none; } .layout-container { max-width: max-content; } }"
  },
  "has_more": true,
  "next_hint": "Create experience"
}
```

---

## 3. sys_aix_experience

**Fields:** title, url_suffix, app_shell, theme, notfound_page, active

```json
{
  "type": "create",
  "table": "sys_aix_experience",
  "data": {
    "title": "My Portal",
    "url_suffix": "my-portal",
    "app_shell": "<app_shell_sys_id>",
    "theme": "<theme_sys_id>",
    "active": true
  },
  "has_more": true,
  "next_hint": "Create route map"
}
```

---

## 4. sys_aix_page_route_map (ONLY for /home redirect)

**Fields:** experience, route_pattern, target_path, order, active

```json
{
  "type": "create",
  "table": "sys_aix_page_route_map",
  "data": {
    "experience": "<experience_sys_id>",
    "route_pattern": "/home",
    "target_path": "/my-portal-landing",
    "order": 100,
    "active": true
  },
  "has_more": true,
  "next_hint": "Create landing page"
}
```

---

## 5. sys_aix_page

**Fields:** title, path_pattern, experience, url_suffix, roles, css, active

```json
{
  "type": "create",
  "table": "sys_aix_page",
  "data": {
    "title": "Landing Page",
    "path_pattern": "/my-portal-landing",
    "experience": "<experience_sys_id>",
    "url_suffix": "my-portal",
    "active": true
  },
  "has_more": true,
  "next_hint": "Create containers"
}
```

---

## 6. sys_aix_container

**Fields:** page, app_shell, order, container_id, classes, parent_container

⚠️ Use `page` OR `app_shell`, NEVER both:
- `page` = container only on that page
- `app_shell` = persistent across all pages (header, sidebar)

```json
{
  "type": "create",
  "table": "sys_aix_container",
  "data": {
    "page": "<page_sys_id>",
    "order": 100,
    "container_id": "main",
    "classes": "flex flex-col gap-6 p-6 max-w-7xl mx-auto"
  },
  "has_more": true,
  "next_hint": "Create widget"
}
```

---

## 7. sys_aix_widget

**Fields:** name, id, sys_scope, script, component, input_schema, description

```json
{
  "type": "create",
  "table": "sys_aix_widget",
  "data": {
    "name": "Welcome Card",
    "id": "welcome-card",
    "sys_scope": "global",
    "description": "Welcome greeting card",
    "input_schema": "{}",
    "script": "(function(data, options, input) { data.greeting = 'Welcome'; data.user = gs.getUserDisplayName(); })(data, options, input);",
    "component": "<SEE WIDGET COMPONENT STRUCTURE>"
  },
  "has_more": true,
  "next_hint": "Place widget in container"
}
```

---

## 8. sys_aix_widget_instance

**Fields:** container, widget, order, name, properties

```json
{
  "type": "create",
  "table": "sys_aix_widget_instance",
  "data": {
    "container": "<container_sys_id>",
    "widget": "<widget_sys_id>",
    "order": 100,
    "name": "welcome-card-instance"
  },
  "has_more": true,
  "next_hint": "Continue with next step"
}
```

---

## 9. sys_aix_menu

**Fields:** name

```json
{
  "type": "create",
  "table": "sys_aix_menu",
  "data": {
    "name": "Main Navigation"
  },
  "has_more": true,
  "next_hint": "Create menu items"
}
```

---

## 10. sys_aix_menu_item

**Fields:** menu, title, target_type, target_url, icon, order, roles, active

```json
{
  "type": "create",
  "table": "sys_aix_menu_item",
  "data": {
    "menu": "<menu_sys_id>",
    "title": "Home",
    "target_type": "url",
    "target_url": "/my-portal-landing",
    "order": 100,
    "active": true
  },
  "has_more": true,
  "next_hint": "Create next menu item"
}
```

---

## Navigate Action

```json
{
  "type": "navigate",
  "url": "/my-portal/home"
}
```

---

## OTHER TABLES

**Dashboards:**
- sys_aix_dashboard - (title, path_pattern, grid_options)
- sys_aix_dashboard_item - (dashboard, widget, grid_props, widget_properties)

**Dependencies:**
- sys_aix_dependency - External JS/CSS
- sys_aix_dependency_bundle - Grouped dependencies
- sys_aix_m2m_widget_dependency - Widget to Dependency link

---

## RULES

1. Use actual sys_ids from previous steps - NEVER placeholders
2. Containers: Use `page` OR `app_shell`, never both
3. Namespaced paths: `/my-portal-landing` not `/landing`
4. Route map: Create BEFORE the landing page
5. Menu: Create AFTER all pages exist
