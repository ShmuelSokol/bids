-- dbo.supplier_invoice_1_view



/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */

/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */


/* view supplier_invoice_1_view: add view */
CREATE VIEW [dbo].[supplier_invoice_1_view]
AS
SELECT     dbo.supplier_1_view.s_code_k39, dbo.supplier_1_view.e_name_k12, dbo.ka1_tab.sinino_ka1, dbo.ka1_tab.sinnum_ka1, dbo.ka1_tab.sindte_ka1, 
                      dbo.ka1_tab.sinsta_ka1, dbo.ka1_tab.sisdte_ka1, dbo.k06_tab.trmdes_k06, dbo.supplier_1_view.idnk39_k39, dbo.ka1_tab.idnka1_ka1, dbo.k06_tab.idnk06_k06
FROM         dbo.supplier_1_view INNER JOIN
                      dbo.ka1_tab ON dbo.supplier_1_view.idnk39_k39 = dbo.ka1_tab.idnk39_ka1 INNER JOIN
                      dbo.k06_tab ON dbo.ka1_tab.idnk06_ka1 = dbo.k06_tab.idnk06_k06


















