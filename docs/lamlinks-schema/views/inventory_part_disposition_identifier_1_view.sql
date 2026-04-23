-- dbo.inventory_part_disposition_identifier_1_view



/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */

/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */


/* view inventory_part_disposition_identifier_1_view: add view */
CREATE VIEW [dbo].[inventory_part_disposition_identifier_1_view]
AS
SELECT     dbo.inventory_part_disposition_1_view.fsc_k08, dbo.inventory_part_disposition_1_view.niin_k08, dbo.inventory_part_disposition_1_view.prtnum_k71, 
                      dbo.inventory_part_disposition_1_view.p_desc_k71, dbo.kaz_tab.x_ucag_kaz, dbo.kaz_tab.x_rcag_kaz, dbo.kaz_tab.x_usno_kaz, dbo.kaz_tab.x_rsno_kaz, 
                      dbo.kaz_tab.x_rhex_kaz, dbo.kaz_tab.idnkaz_kaz, dbo.inventory_part_disposition_1_view.idnka4_ka4, dbo.inventory_part_disposition_1_view.idnk93_k93
FROM         dbo.inventory_part_disposition_1_view INNER JOIN
                      dbo.kaz_tab ON dbo.inventory_part_disposition_1_view.idnka4_ka4 = dbo.kaz_tab.idnxcs_kaz AND dbo.kaz_tab.xcstbl_kaz = 'ka4'


















