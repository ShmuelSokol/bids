-- dbo.inventory_sum_shipment_1_view



/* view inventory_sum_shipment_1_view: add view */


/* view inventory_sum_shipment_1_view: add view */


/* view inventory_sum_shipment_1_view: add view */

/* view inventory_sum_shipment_1_view: add view */


/* view inventory_sum_shipment_1_view: add view */


/* view inventory_sum_shipment_1_view: add view */


/* view inventory_sum_shipment_1_view: add view */


/* view inventory_sum_shipment_1_view: add view */


/* view inventory_sum_shipment_1_view: add view */
CREATE VIEW [dbo].[inventory_sum_shipment_1_view]
AS
SELECT        SUM(dspqty_ka4) AS dspqty_shp, idnk93_k93, idnk81_k81
FROM            dbo.inventory_part_shipment_1_view
GROUP BY idnk93_k93, idnk81_k81









