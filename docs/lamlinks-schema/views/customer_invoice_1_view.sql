-- dbo.customer_invoice_1_view



/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */

/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */


/* view customer_invoice_1_view: add view */
CREATE VIEW [dbo].[customer_invoice_1_view]
AS
SELECT     dbo.k12_tab.e_name_k12, dbo.k31_tab.a_code_k31, dbo.kad_tab.cin_no_kad, dbo.kad_tab.cinnum_kad, dbo.kad_tab.cindte_kad, dbo.k06_tab.trmdes_k06, 
                      dbo.k06_tab.idnk06_k06, dbo.k12_tab.idnk12_k12, dbo.k31_tab.idnk31_k31, dbo.kad_tab.idnkad_kad
FROM         dbo.kad_tab INNER JOIN
                      dbo.k31_tab ON dbo.kad_tab.idnk31_kad = dbo.k31_tab.idnk31_k31 INNER JOIN
                      dbo.k06_tab ON dbo.kad_tab.idnk06_kad = dbo.k06_tab.idnk06_k06 INNER JOIN
                      dbo.k12_tab ON dbo.k31_tab.idnk12_k31 = dbo.k12_tab.idnk12_k12


















