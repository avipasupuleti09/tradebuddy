function normalizeSortValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return null;
  }

  const compactNumber = stringValue.replace(/,/g, "");
  const numericValue = Number(compactNumber);
  if (Number.isFinite(numericValue) && /^-?\d+(\.\d+)?$/.test(compactNumber)) {
    return numericValue;
  }

  const timestamp = Date.parse(stringValue);
  if (Number.isFinite(timestamp) && /[:/\-]/.test(stringValue)) {
    return timestamp;
  }

  return stringValue.toLowerCase();
}

export function compareTableValues(left, right, direction = "asc") {
  const normalizedLeft = normalizeSortValue(left);
  const normalizedRight = normalizeSortValue(right);
  const multiplier = direction === "desc" ? -1 : 1;

  if (normalizedLeft === null && normalizedRight === null) {
    return 0;
  }
  if (normalizedLeft === null) {
    return 1;
  }
  if (normalizedRight === null) {
    return -1;
  }

  if (typeof normalizedLeft === "number" && typeof normalizedRight === "number") {
    return (normalizedLeft - normalizedRight) * multiplier;
  }

  return String(normalizedLeft).localeCompare(String(normalizedRight), undefined, {
    numeric: true,
    sensitivity: "base",
  }) * multiplier;
}

export function getNextSortState(currentState, key, defaultDirection = "asc") {
  if (currentState?.key === key) {
    if (currentState.direction === "desc") {
      return {
        key: null,
        direction: null,
      };
    }

    return {
      key,
      direction: currentState.direction === "asc" ? "desc" : "asc",
    };
  }

  return {
    key,
    direction: defaultDirection,
  };
}

export function sortRowsByAccessor(rows, sortState, accessorMap) {
  if (!sortState?.key || !Array.isArray(rows) || !rows.length) {
    return rows;
  }

  const accessor = accessorMap?.[sortState.key];
  if (typeof accessor !== "function") {
    return rows;
  }

  return [...rows].sort((leftRow, rightRow) => compareTableValues(
    accessor(leftRow),
    accessor(rightRow),
    sortState.direction,
  ));
}