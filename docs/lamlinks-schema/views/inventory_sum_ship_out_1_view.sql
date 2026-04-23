-- dbo.inventory_sum_ship_out_1_view



/* view inventory_sum_ship_out_1_view: add view */


/* view inventory_sum_ship_out_1_view: add view */


/* view inventory_sum_ship_out_1_view: add view */

/* view inventory_sum_ship_out_1_view: add view */


/* view inventory_sum_ship_out_1_view: add view */


/* view inventory_sum_ship_out_1_view: add view */


/* view inventory_sum_ship_out_1_view: add view */


/* view inventory_sum_ship_out_1_view: add view */


/* view inventory_sum_ship_out_1_view: add view */
CREATE VIEW [dbo].[inventory_sum_ship_out_1_view]
AS
SELECT        SUM(dspqty_ka4) AS dspqty_osp, idnK93_k93
FROM            dbo.ship_out_line_3_view
GROUP BY idnK93_k93









