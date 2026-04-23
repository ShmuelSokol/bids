-- dbo.inventory_sum_part_into_make_1_view



/* view inventory_sum_part_into_make_1_view: add view */


/* view inventory_sum_part_into_make_1_view: add view */


/* view inventory_sum_part_into_make_1_view: add view */

/* view inventory_sum_part_into_make_1_view: add view */


/* view inventory_sum_part_into_make_1_view: add view */


/* view inventory_sum_part_into_make_1_view: add view */


/* view inventory_sum_part_into_make_1_view: add view */


/* view inventory_sum_part_into_make_1_view: add view */


/* view inventory_sum_part_into_make_1_view: add view */
CREATE VIEW [dbo].[inventory_sum_part_into_make_1_view]
AS
SELECT        SUM(dspqty_ka4) AS dspqty_cmp, idnk93_k93
FROM            dbo.inventory_part_into_make_1_view
GROUP BY idnk93_k93









