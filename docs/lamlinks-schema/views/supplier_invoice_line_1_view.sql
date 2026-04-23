-- dbo.supplier_invoice_line_1_view



/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */

/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */


/* view supplier_invoice_line_1_view: add view */
CREATE VIEW [dbo].[supplier_invoice_line_1_view]
AS
SELECT     dbo.ka2_tab.sil_no_ka2, dbo.ka2_tab.silcls_ka2, dbo.ka2_tab.sildes_ka2, dbo.ka2_tab.silqty_ka2, dbo.ka2_tab.sil_up_ka2, dbo.ka2_tab.sil_ui_ka2, 
                      dbo.ka2_tab.silext_ka2, dbo.supplier_invoice_1_view.idnka1_ka1, dbo.ka2_tab.idnka2_ka2, dbo.supplier_invoice_1_view.s_code_k39, 
                      dbo.supplier_invoice_1_view.e_name_k12, dbo.supplier_invoice_1_view.sinino_ka1, dbo.supplier_invoice_1_view.sinnum_ka1
FROM         dbo.supplier_invoice_1_view INNER JOIN
                      dbo.ka2_tab ON dbo.supplier_invoice_1_view.idnka1_ka1 = dbo.ka2_tab.idnka1_ka2


















