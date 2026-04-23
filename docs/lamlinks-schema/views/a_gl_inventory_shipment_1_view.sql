-- dbo.a_gl_inventory_shipment_1_view



/* view a_gl_inventory_shipment_1_view: add view */


/* view a_gl_inventory_shipment_1_view: add view */


/* view a_gl_inventory_shipment_1_view: add view */

/* view a_gl_inventory_shipment_1_view: add view */


/* view a_gl_inventory_shipment_1_view: add view */
CREATE VIEW [dbo].[a_gl_inventory_shipment_1_view]
AS
SELECT     dbo.inventory_part_shipment_1_view.cntrct_k79, dbo.inventory_part_shipment_1_view.rel_no_k80, dbo.inventory_part_shipment_1_view.clinno_k81, 
                      dbo.inventory_part_shipment_1_view.fsc_k08, dbo.inventory_part_shipment_1_view.niin_k08, dbo.inventory_part_shipment_1_view.prtnum_k71, 
                      dbo.inventory_part_shipment_1_view.p_desc_k71, dbo.gl_transaction_1_view.gl_nam_crd, dbo.gl_transaction_1_view.gl_nam_dbt, 
                      dbo.gl_transaction_1_view.postfl_k94, dbo.gl_transaction_1_view.posdte_k94
FROM         dbo.gl_transaction_1_view INNER JOIN
                      dbo.inventory_part_shipment_1_view ON dbo.gl_transaction_1_view.idnprm_k94 = dbo.inventory_part_shipment_1_view.idnka4_ka4
WHERE     (dbo.gl_transaction_1_view.prmtbl_k94 = 'ka4')





