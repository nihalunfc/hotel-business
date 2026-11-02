-- Triage rungs 3-4 against the demo warehouse: is the data current, and does it look complete?
-- Run: python ai-workflow/tools/ro_sql.py ai-workflow/examples/triage_checks.sql --sqlite data/generated/warehouse.sqlite

-- Freshness: latest booking received per hotel
SELECT h.hotel_id, h.hotel_name, MAX(b.booking_date) AS latest_booking
FROM fact_booking b JOIN dim_hotel h USING (hotel_id)
GROUP BY h.hotel_id, h.hotel_name
ORDER BY latest_booking
;;
-- Volume: bookings received per day over the last 14 days, to spot a zero-row load
WITH last AS (SELECT MAX(booking_date) AS d FROM fact_booking)
SELECT booking_date, COUNT(*) AS bookings
FROM fact_booking, last
WHERE booking_date > DATE(last.d, '-14 day')
GROUP BY booking_date
ORDER BY booking_date
;;
-- Completeness: share of bookings whose revenue was imputed, per hotel
SELECT hotel_id, ROUND(100.0 * AVG(revenue_imputed), 2) AS pct_revenue_imputed
FROM fact_booking
GROUP BY hotel_id
ORDER BY pct_revenue_imputed DESC
