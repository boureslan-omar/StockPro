-- FIFO stock deduction, ported from includes/functions.php::deductStockFIFO.
-- Depletes oldest batches first, updates products.stock, returns weighted unit cost.
create or replace function public.deduct_stock_fifo(p_product_id int, p_qty numeric)
returns numeric
language plpgsql
as $$
declare
  batch record;
  remaining numeric := p_qty;
  take numeric;
  total_cost numeric := 0;
begin
  if p_qty <= 0 then
    return 0;
  end if;

  for batch in
    select id, cost_price, quantity_remaining
    from public.batches
    where product_id = p_product_id and quantity_remaining > 0
    order by created_at asc, id asc
  loop
    if remaining <= 0 then
      exit;
    end if;
    take := least(remaining, batch.quantity_remaining);
    total_cost := total_cost + take * batch.cost_price;
    update public.batches set quantity_remaining = quantity_remaining - take where id = batch.id;
    remaining := remaining - take;
  end loop;

  update public.products set stock = greatest(0, stock - p_qty) where id = p_product_id;

  if p_qty > 0 then
    return total_cost / p_qty;
  end if;
  return 0;
end;
$$;
