-- dbo.a_customer_invoice_line_2_view



/* view a_customer_invoice_line_2_view: add view */


/* view a_customer_invoice_line_2_view: add view */


/* view a_customer_invoice_line_2_view: add view */

/* view a_customer_invoice_line_2_view: add view */


/* view a_customer_invoice_line_2_view: add view */


/* view a_customer_invoice_line_2_view: add view */


/* view a_customer_invoice_line_2_view: add view */


/* view a_customer_invoice_line_2_view: add view */


/* view a_customer_invoice_line_2_view: add view */


/* view a_customer_invoice_line_2_view: add view */
/* view acustomer_invoice_line_2_view: add view 
 view customer_invoice_line_2_view: add view 
 view customer_invoice_line_2_view: add view 
 view customer_invoice_line_2_view: add view 
 view customer_invoice_line_2_view: add view 
 view customer_invoice_line_2_view: add view 
 view customer_invoice_line_2_view: add view 
 view customer_invoice_line_2_view: add view */
CREATE VIEW [dbo].[a_customer_invoice_line_2_view]
AS
SELECT        dbo.clin_basic_1_view.cntrct_k79, dbo.clin_basic_1_view.rel_no_k80, dbo.clin_basic_1_view.clinno_k81, dbo.clin_basic_1_view.reldte_k80, dbo.clin_basic_1_view.clnqty_k81, 
                         dbo.clin_basic_1_view.cage_k13 AS e_code_mfg, dbo.clin_basic_1_view.prtnum_k71, dbo.clin_basic_1_view.p_desc_k71, dbo.clin_basic_1_view.fsc_k08, dbo.clin_basic_1_view.niin_k08, 
                         dbo.a_customer_invoice_line_1a_view.e_name_k12, dbo.a_customer_invoice_line_1a_view.cin_no_kad, dbo.a_customer_invoice_line_1a_view.cinnum_kad, dbo.a_customer_invoice_line_1a_view.cindte_kad, 
                         dbo.a_customer_invoice_line_1a_view.trmdes_k06, dbo.a_customer_invoice_line_1a_view.cilqty_kae, dbo.a_customer_invoice_line_1a_view.cil_up_kae, dbo.a_customer_invoice_line_1a_view.cil_ui_kae, 
                         dbo.a_customer_invoice_line_1a_view.cilext_kae, dbo.clin_basic_1_view.idnk81_k81, dbo.a_customer_invoice_line_1a_view.idnkae_kae, dbo.a_customer_invoice_line_1a_view.idnkad_kad
FROM            dbo.a_customer_invoice_line_1a_view INNER JOIN
                         dbo.ka9_tab ON dbo.a_customer_invoice_line_1a_view.idnkae_kae = dbo.ka9_tab.idnkae_ka9 INNER JOIN
                         dbo.clin_basic_1_view ON dbo.ka9_tab.idnk81_ka9 = dbo.clin_basic_1_view.idnk81_k81










