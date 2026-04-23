-- dbo.inventory_sum_reserve_1_view



/* view inventory_sum_reserve_1_view: add view */


/* view inventory_sum_reserve_1_view: add view */


/* view inventory_sum_reserve_1_view: add view */

/* view inventory_sum_reserve_1_view: add view */


/* view inventory_sum_reserve_1_view: add view */


/* view inventory_sum_reserve_1_view: add view */


/* view inventory_sum_reserve_1_view: add view */


/* view inventory_sum_reserve_1_view: add view */


/* view inventory_sum_reserve_1_view: add view */
CREATE VIEW [dbo].[inventory_sum_reserve_1_view]
AS
SELECT        SUM(rsvqty_kak) AS dspqty_rsv, idnk93_k93, rsttbl_kak, idnk81_k81
FROM            dbo.material_reserve_1_view
GROUP BY idnk93_k93, rsttbl_kak, idnk81_k81
HAVING        (rsttbl_kak = 'k93')









