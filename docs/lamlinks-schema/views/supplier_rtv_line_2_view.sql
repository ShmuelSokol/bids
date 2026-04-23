-- dbo.supplier_rtv_line_2_view



/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */

/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */


/* view supplier_rtv_line_2_view: add view */
CREATE VIEW [dbo].[supplier_rtv_line_2_view]
AS
SELECT     dbo.inventory_part_disposition_1_view.mdrnum_kc6, dbo.supplier_rtv_line_1_view.s_code_k39, dbo.supplier_rtv_line_1_view.e_name_k12, 
                      dbo.supplier_rtv_line_1_view.dmcnum_kcr, dbo.supplier_rtv_line_1_view.mdl_up_kc8, dbo.supplier_rtv_line_1_view.dml_up_kcs, 
                      dbo.supplier_rtv_line_1_view.ucrval_ka4, dbo.supplier_rtv_line_1_view.ufsval_ka4, dbo.supplier_rtv_line_1_view.dspqty_ka4, 
                      dbo.supplier_rtv_line_1_view.idnkcq_kcq, dbo.supplier_rtv_line_1_view.idnkcs_kcs, dbo.supplier_rtv_line_1_view.dmlqty_kcs, 
                      dbo.supplier_rtv_line_1_view.mdlqty_kc8, dbo.supplier_rtv_line_1_view.idnkc8_kc8, dbo.supplier_rtv_line_1_view.idnkcr_kcr, dbo.supplier_rtv_line_1_view.fsc_k08, 
                      dbo.supplier_rtv_line_1_view.niin_k08, dbo.supplier_rtv_line_1_view.prtnum_k71, dbo.supplier_rtv_line_1_view.p_desc_k71, 
                      dbo.supplier_rtv_line_1_view.idnk93_k93, dbo.inventory_part_disposition_1_view.idnkc6_kc6
FROM         dbo.inventory_part_disposition_1_view INNER JOIN
                      dbo.supplier_rtv_line_1_view ON dbo.inventory_part_disposition_1_view.idnkc8_kc8 = dbo.supplier_rtv_line_1_view.idnkc8_kc8


















