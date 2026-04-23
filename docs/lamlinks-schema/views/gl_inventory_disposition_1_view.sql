-- dbo.gl_inventory_disposition_1_view



/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */

/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */


/* view gl_inventory_disposition_1_view: add view */
CREATE VIEW [dbo].[gl_inventory_disposition_1_view]
AS
SELECT     dbo.inventory_part_disposition_1_view.niin_k08, dbo.inventory_part_disposition_1_view.prtnum_k71, dbo.inventory_part_disposition_1_view.p_desc_k71, 
                      dbo.inventory_part_disposition_1_view.dspqty_ka4, dbo.inventory_part_disposition_1_view.mdrdte_kc6, dbo.gl_transaction_1_view.gl_nam_dbt, 
                      dbo.gl_transaction_1_view.gl_nam_crd, dbo.gl_transaction_1_view.gl_val_k94, dbo.gl_transaction_1_view.gl_des_k94, 
                      dbo.inventory_part_disposition_1_view.posdte_ka4, dbo.inventory_part_disposition_1_view.postfl_ka4, dbo.inventory_part_disposition_1_view.ucrval_ka4, 
                      dbo.inventory_part_disposition_1_view.ufsval_ka4, dbo.gl_transaction_1_view.idnk94_k94, dbo.inventory_part_disposition_1_view.idnka4_ka4, 
                      dbo.gl_transaction_1_view.ft1tbl_k94, dbo.inventory_part_disposition_1_view.idnkc6_kc6, dbo.gl_transaction_1_view.postfl_k94, 
                      dbo.gl_transaction_1_view.posdte_k94, dbo.inventory_part_disposition_1_view.idnkc8_kc8
FROM         dbo.gl_transaction_1_view INNER JOIN
                      dbo.inventory_part_disposition_1_view ON dbo.gl_transaction_1_view.idnft1_k94 = dbo.inventory_part_disposition_1_view.idnkc8_kc8
WHERE     (dbo.gl_transaction_1_view.ft1tbl_k94 = 'kc8')


















