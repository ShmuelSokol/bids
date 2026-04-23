-- dbo.a_customer_invoice_line_1a_view



/* view a_customer_invoice_line_1a_view: add view */


/* view a_customer_invoice_line_1a_view: add view */


/* view a_customer_invoice_line_1a_view: add view */

/* view a_customer_invoice_line_1a_view: add view */


/* view a_customer_invoice_line_1a_view: add view */


/* view a_customer_invoice_line_1a_view: add view */


/* view a_customer_invoice_line_1a_view: add view */


/* view a_customer_invoice_line_1a_view: add view */


/* view a_customer_invoice_line_1a_view: add view */


/* view a_customer_invoice_line_1a_view: add view */


/* view a_customer_invoice_line_1a_view: add view */
/* view customer_invoice_line_1a_view: add view 
 view customer_invoice_line_1_view: add view 
 view customer_invoice_line_1_view: add view 
 view customer_invoice_line_1_view: add view 
 view customer_invoice_line_1_view: add view 
 view customer_invoice_line_1_view: add view 
 view customer_invoice_line_1_view: add view */
CREATE VIEW [dbo].[a_customer_invoice_line_1a_view]
AS
SELECT        dbo.kae_tab.cilqty_kae, dbo.kae_tab.cil_up_kae, dbo.kae_tab.cil_ui_kae, dbo.kae_tab.cilext_kae, dbo.customer_invoice_1_view.e_name_k12, dbo.customer_invoice_1_view.cin_no_kad, 
                         dbo.customer_invoice_1_view.cinnum_kad, dbo.customer_invoice_1_view.cindte_kad, dbo.customer_invoice_1_view.trmdes_k06, dbo.kae_tab.idnkae_kae, dbo.customer_invoice_1_view.idnkad_kad
FROM            dbo.customer_invoice_1_view INNER JOIN
                         dbo.kae_tab ON dbo.customer_invoice_1_view.idnkad_kad = dbo.kae_tab.idnkad_kae











