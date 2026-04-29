import type { DashboardLocation } from "@/components/inventory/dashboard-types";

export function flattenTree(nodes: DashboardLocation[], prefix = ""): DashboardLocation[] {
  let result: DashboardLocation[] = [];

  nodes.forEach((node) => {
    result.push({ ...node, name: `${prefix}${node.name}` });

    if (node.children?.length) {
      result = result.concat(flattenTree(node.children, `${prefix}-> `));
    }
  });

  return result;
}

export function buildTree(locations: DashboardLocation[]): DashboardLocation[] {
  const map: Record<string, DashboardLocation> = {};
  const roots: DashboardLocation[] = [];

  locations.forEach((location) => {
    map[location.id] = { ...location, children: [] };
  });

  locations.forEach((location) => {
    if (location.parent_id) {
      map[location.parent_id]?.children?.push(map[location.id]);
    } else {
      roots.push(map[location.id]);
    }
  });

  return roots;
}

export function getInitialSelectedLocation(locations: DashboardLocation[]) {
  const firstRoot = locations.find((location) => !location.parent_id);
  return firstRoot?.id ?? locations[0]?.id ?? null;
}
