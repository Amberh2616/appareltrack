"""
Costing Calculation Services
Phase 2-2I: 統一的 Decimal 計算與 rounding 規則
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Tuple


# Quantize constants
MONEY_Q = Decimal("0.01")      # 2 decimal places for currency
LINE_Q = Decimal("0.0001")     # 4 decimal places for line costs


def q_money(x: Decimal) -> Decimal:
    """Quantize to 2 decimal places (for currency)"""
    return x.quantize(MONEY_Q, rounding=ROUND_HALF_UP)


def q_line(x: Decimal) -> Decimal:
    """Quantize to 4 decimal places (for line costs)"""
    return x.quantize(LINE_Q, rounding=ROUND_HALF_UP)


def calc_line_cost(consumption: Decimal, unit_price: Decimal, wastage_pct: Decimal) -> Decimal:
    """
    計算 line_cost（統一公式）

    Formula: consumption × unit_price × (1 + wastage_pct/100)

    Args:
        consumption: Consumption per garment (Decimal)
        unit_price: Unit price (Decimal)
        wastage_pct: Wastage percentage (Decimal, e.g., 5.00 for 5%)

    Returns:
        Decimal: Line cost with 4 decimal places
    """
    consumption = Decimal(str(consumption))
    unit_price = Decimal(str(unit_price))
    wastage_pct = Decimal(str(wastage_pct))

    factor = Decimal("1.00") + (wastage_pct / Decimal("100.00"))
    line_cost = consumption * unit_price * factor

    return q_line(line_cost)


def calc_totals(
    line_costs: Iterable[Decimal],
    labor: Decimal,
    overhead: Decimal,
    freight: Decimal,
    packaging: Decimal,
    testing: Decimal,
    margin_pct: Decimal,
) -> Tuple[Decimal, Decimal, Decimal]:
    """
    計算總成本與報價（統一公式）

    Args:
        line_costs: Iterable of line costs (Decimal)
        labor: Labor cost (Decimal)
        overhead: Overhead cost (Decimal)
        freight: Freight cost (Decimal)
        packaging: Packaging cost (Decimal)
        testing: Testing cost (Decimal)
        margin_pct: Margin percentage (Decimal, e.g., 30.00 for 30%)

    Returns:
        Tuple[Decimal, Decimal, Decimal]: (material_cost, total_cost, unit_price)

    Raises:
        ValueError: If margin_pct is invalid
    """
    # Material cost (sum of line costs) - 2 decimal places
    material_cost = q_money(sum(line_costs, Decimal("0.0000")))

    # Total COGS - 2 decimal places
    total_cost = q_money(
        material_cost + labor + overhead + freight + packaging + testing
    )

    # Validate margin
    if margin_pct is None:
        margin_pct = Decimal("0")

    if margin_pct < 0 or margin_pct >= 100:
        raise ValueError("margin_pct must be in [0, 100).")

    # Unit price = total_cost / (1 - margin%)
    denom = Decimal("1.00") - (margin_pct / Decimal("100.00"))

    if denom == 0:
        unit_price = total_cost
    else:
        unit_price = q_money(total_cost / denom)

    return material_cost, total_cost, unit_price
