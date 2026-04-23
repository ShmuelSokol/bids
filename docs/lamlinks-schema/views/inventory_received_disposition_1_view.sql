-- dbo.inventory_received_disposition_1_view



/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */

/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */


/* view inventory_received_disposition_1_view: add view */
CREATE VIEW [dbo].[inventory_received_disposition_1_view]
AS
SELECT     dbo.inventory_part_disposition_1_view.fsc_k08, dbo.inventory_part_disposition_1_view.niin_k08, dbo.inventory_part_disposition_1_view.prtnum_k71, 
                      dbo.inventory_part_disposition_1_view.p_desc_k71, dbo.inventory_part_disposition_1_view.dspqty_ka4, dbo.inventory_part_disposition_1_view.idnk93_k93, 
                      dbo.inventory_part_disposition_1_view.idnka4_ka4, dbo.inventory_part_received_1_view.idnkbh_kbh, dbo.inventory_part_disposition_1_view.idnkc8_kc8
FROM         dbo.inventory_part_disposition_1_view INNER JOIN
                      dbo.inventory_part_received_1_view ON dbo.inventory_part_disposition_1_view.idnk93_k93 = dbo.inventory_part_received_1_view.idnk93_k93


















