-- dbo.inventory_part_disposition_1_view



/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */

/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */


/* view inventory_part_disposition_1_view: add view */
CREATE VIEW [dbo].[inventory_part_disposition_1_view]
AS
SELECT     dbo.inventory_part_1_view.fsc_k08, dbo.inventory_part_1_view.niin_k08, dbo.inventory_part_1_view.prtnum_k71, dbo.inventory_part_1_view.p_desc_k71, 
                      dbo.ka4_tab.dspqty_ka4, dbo.kc6_tab.mdrnum_kc6, dbo.kc6_tab.mdrdte_kc6, dbo.kc6_tab.mdrsta_kc6, dbo.inventory_part_1_view.idnk93_k93, 
                      dbo.ka4_tab.idnka4_ka4, dbo.kc8_tab.idnkc8_kc8, dbo.kc6_tab.idnkc6_kc6, dbo.kc8_tab.mdlqty_kc8, dbo.kc8_tab.srr_12_kc8, dbo.kc8_tab.mdldes_kc8, 
                      dbo.kc8_tab.mdl_no_kc8, dbo.kap_tab.catdes_kap, dbo.kap_tab.idnkap_kap, dbo.kc8_tab.mdl_up_kc8, dbo.ka4_tab.posdte_ka4, dbo.ka4_tab.postfl_ka4, 
                      dbo.ka4_tab.ucrval_ka4, dbo.ka4_tab.ufsval_ka4, dbo.kc8_tab.drstbl_kc8, dbo.kc8_tab.idndrs_kc8
FROM         dbo.ka4_tab INNER JOIN
                      dbo.kc8_tab ON dbo.ka4_tab.idniru_ka4 = dbo.kc8_tab.idnkc8_kc8 INNER JOIN
                      dbo.inventory_part_1_view ON dbo.ka4_tab.idnk93_ka4 = dbo.inventory_part_1_view.idnk93_k93 INNER JOIN
                      dbo.kc6_tab ON dbo.kc8_tab.idnkc6_kc8 = dbo.kc6_tab.idnkc6_kc6 INNER JOIN
                      dbo.kap_tab ON dbo.kc6_tab.idnkap_kc6 = dbo.kap_tab.idnkap_kap
WHERE     (dbo.ka4_tab.irutbl_ka4 = 'kc8')


















