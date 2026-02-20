# UI Design Concept v2.0: Deep Dive

## 1. Functional Area Layout (The "Workspace")

The screen is divided into three distinct zones to maximize efficiency:

### Zone A: Navigation & Context (Left Sidebar - 240px)
*   **Purpose**: Quick switching between modules without losing context.
*   **Structure**:
    *   **Top**: Global Search (Cmd+K), Notifications.
    *   **Middle (Modules)**:
        *   `Dashboard` (The Command Center)
        *   `Tech Packs` (Input & Parsing)
        *   `BOM & Costing` (The "Excel" replacement)
        *   `Production` (TNA & Status)
    *   **Bottom**: User Profile, Settings.

### Zone B: The Active Workspace (Center - Flexible)
This is where work happens. It changes based on the module but follows a standard pattern:
*   **Header**: Breadcrumbs (`Styles / LW1FLWS / BOM`), Status Badge (`Draft`), Primary Actions (`Save`, `Export`).
*   **Content**:
    *   **List View**: Sortable, filterable tables with status indicators.
    *   **Detail View**: Split-screen or Tabbed interface.
        *   *Example*: Left side = PDF Viewer, Right side = Data Form.

### Zone C: The AI Assistant Panel (Right Sidebar - Collapsible 300px)
*   **Purpose**: Context-aware AI assistance that doesn't block the main view.
*   **Behavior**:
    *   **Passive**: Shows "Analysis Complete: 98% Confidence".
    *   **Active**: Expands when issues are found or suggestions are available.

---

## 2. AI Interaction Patterns

We don't just "chat" with AI. The AI interacts in 3 specific ways:

### Pattern 1: The "Silent Filler" (Implicit)
*   **Scenario**: Uploading a Tech Pack.
*   **UI**: You see a progress bar. When finished, the form is **already filled**.
*   **Interaction**: You see fields highlighted in **Green** (High Confidence) or **Amber** (Low Confidence). You only click the Amber ones to fix them.

### Pattern 2: The "Risk Guard" (Reactive)
*   **Scenario**: You enter a fabric consumption that is too low.
*   **UI**: A small warning icon appears next to the field. Hovering shows a tooltip: *"AI Alert: Historical data suggests 1.5m for this category, but you entered 1.2m."*
*   **Interaction**: Click "Fix" to auto-update, or "Dismiss" to ignore.

![AI Conflict Resolution](/C:/Users/AMBER/.gemini/antigravity/brain/4203a1ac-9a64-453d-900a-d9dc0282dab0/ai_conflict_resolution_1765680741545.png)

### Pattern 3: The "Smart Optimizer" (Proactive)
*   **Scenario**: Creating a BOM.
*   **UI**: The AI Copilot panel slides out. *"Suggestion: Switch Supplier to 'Eclat' to save $0.50/yd (Same material spec found)."*
*   **Interaction**: Click "Apply" to update the BOM row instantly.

![BOM Copilot Interaction](/C:/Users/AMBER/.gemini/antigravity/brain/4203a1ac-9a64-453d-900a-d9dc0282dab0/bom_copilot_interaction_1765680758248.png)

---

## 3. Detailed Screen Breakdowns

### A. Tech Pack Parsing Screen
*   **Layout**: Split 50/50.
*   **Left**: PDF Viewer with bounding boxes drawn around extracted data.
*   **Right**: Form fields corresponding to the boxes.
*   **Interaction**: Clicking a form field zooms the PDF to the relevant box.

### B. Production TNA (Time & Action) Calendar
*   **Layout**: Gantt Chart + Kanban.
*   **AI Feature**: "Predictive Delay".
*   **UI**: If a fabric is late, the AI highlights dependent tasks (e.g., "Sewing Start") in Red and suggests a new timeline.
