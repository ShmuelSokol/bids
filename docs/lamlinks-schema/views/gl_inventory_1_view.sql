-- dbo.gl_inventory_1_view



/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */

/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */


/* view gl_inventory_1_view: add view */
CREATE VIEW [dbo].[gl_inventory_1_view]
AS
SELECT     dbo.inventory_part_2_view.fsc_k08, dbo.inventory_part_2_view.niin_k08, dbo.inventory_part_2_view.e_code_mfg, dbo.inventory_part_2_view.prtnum_k71, 
                      dbo.inventory_part_2_view.pn_rev_k71, dbo.inventory_part_2_view.p_desc_k71, dbo.inventory_part_2_view.instat_k93, dbo.inventory_part_2_view.ictref_kbb, 
                      dbo.inventory_part_2_view.e_code_imp, dbo.inventory_part_2_view.e_name_imp, dbo.inventory_part_2_view.e_code_vnd, dbo.inventory_part_2_view.e_name_vnd, 
                      dbo.inventory_part_2_view.por_no_k89, dbo.inventory_part_2_view.cnt_no_k89, dbo.gl_transaction_1_view.gl_val_k94, dbo.inventory_part_2_view.invsta_k93, 
                      dbo.inventory_part_2_view.locatn_kbc, dbo.inventory_part_2_view.rcvdte_k98, dbo.gl_transaction_1_view.gl_nam_dbt, dbo.gl_transaction_1_view.gl_nam_crd
FROM         dbo.gl_transaction_1_view INNER JOIN
                      dbo.inventory_part_2_view ON dbo.gl_transaction_1_view.idnprm_k94 = dbo.inventory_part_2_view.idnk93_k93
WHERE     (dbo.gl_transaction_1_view.prmtbl_k94 = 'k93')


















