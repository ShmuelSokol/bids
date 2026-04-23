-- dbo.our_quote_line_4_view



/* view our_quote_line_4_view: add view */


/* view our_quote_line_4_view: add view */


/* view our_quote_line_4_view: add view */

/* view our_quote_line_4_view: add view */


/* view our_quote_line_4_view: add view */


/* view our_quote_line_4_view: add view */


/* view our_quote_line_4_view: add view */


/* view our_quote_line_4_view: add view */


/* view our_quote_line_4_view: add view */


/* view our_quote_line_4_view: add view */
CREATE VIEW [dbo].[our_quote_line_4_view]
AS
SELECT        dbo.customer_1_view.e_code_k12 AS e_code_qto, dbo.customer_1_view.e_name_k12 AS e_name_qto, dbo.customer_1_view.q_mode_kdw, dbo.our_quote_line_1_view.trmdes_k34, 
                         dbo.our_quote_line_1_view.sol_no_k10, dbo.our_quote_line_1_view.niin_k08, dbo.our_quote_line_1_view.fsc_k08, dbo.our_quote_line_1_view.p_desc_k08, dbo.our_quote_line_1_view.source_k09, 
                         dbo.customer_1_view.idnk12_k12 AS idnk12_qto, dbo.our_quote_line_1_view.idnk34_k34, dbo.customer_1_view.idnk06_k06
FROM            dbo.our_quote_line_1_view INNER JOIN
                         dbo.customer_1_view ON dbo.our_quote_line_1_view.idnk31_k10 = dbo.customer_1_view.idnk31_k31










