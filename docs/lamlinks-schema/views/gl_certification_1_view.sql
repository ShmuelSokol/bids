-- dbo.gl_certification_1_view



/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */

/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */


/* view gl_certification_1_view: add view */
CREATE VIEW [dbo].[gl_certification_1_view]
AS
SELECT DISTINCT 
                      TOP (100) PERCENT dbo.gl_transaction_1_view.idnk94_k94, dbo.supplier_invoice_1_view.s_code_k39, dbo.supplier_invoice_1_view.e_name_k12, 
                      dbo.supplier_invoice_1_view.sinino_ka1, dbo.supplier_invoice_1_view.sindte_ka1, dbo.supplier_invoice_line_1_view.sil_no_ka2, 
                      dbo.supplier_invoice_line_1_view.silcls_ka2, dbo.supplier_invoice_line_1_view.sildes_ka2, dbo.supplier_invoice_line_1_view.silqty_ka2, 
                      dbo.inventory_part_received_1_view.fsc_k08, dbo.inventory_part_received_1_view.niin_k08, dbo.inventory_part_received_1_view.prtnum_k71, 
                      dbo.inventory_part_received_1_view.p_desc_k71, dbo.inventory_part_received_1_view.idnk93_k93, dbo.supplier_invoice_line_1_view.idnka2_ka2
FROM         dbo.supplier_invoice_line_1_view RIGHT OUTER JOIN
                      dbo.gl_transaction_1_view INNER JOIN
                      dbo.supplier_invoice_1_view ON dbo.gl_transaction_1_view.idnft1_k94 = dbo.supplier_invoice_1_view.idnka1_ka1 ON 
                      dbo.supplier_invoice_line_1_view.idnka1_ka1 = dbo.supplier_invoice_1_view.idnka1_ka1 LEFT OUTER JOIN
                      dbo.kbk_tab ON dbo.supplier_invoice_line_1_view.idnka2_ka2 = dbo.kbk_tab.idnka2_kbk LEFT OUTER JOIN
                      dbo.inventory_part_received_1_view ON dbo.kbk_tab.idnkbh_kbk = dbo.inventory_part_received_1_view.idnkbh_kbh
WHERE     (dbo.gl_transaction_1_view.ft1tbl_k94 = 'ka1')


















