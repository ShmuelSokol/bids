-- dbo.our_quote_line_3_view



/* view our_quote_line_3_view: add view */


/* view our_quote_line_3_view: add view */


/* view our_quote_line_3_view: add view */

/* view our_quote_line_3_view: add view */


/* view our_quote_line_3_view: add view */
/* view our_quote_line_3_view: add view 
 view our_quote_line_3_view: add view 
 view our_quote_line_3_view: add view 
 view our_quote_line_3_view: add view 
 view our_quote_line_3_view: add view 
 view our_quote_line_3_view: add view 
 view our_quote_line_3_view: add view */
CREATE VIEW dbo.our_quote_line_3_view
AS
SELECT        dbo.our_quote_line_1_view.sol_no_k10, dbo.our_quote_line_1_view.niin_k08, dbo.our_quote_line_1_view.fsc_k08, dbo.our_quote_line_1_view.p_desc_k08, dbo.our_quote_line_1_view.qty_k35, 
                         dbo.our_quote_line_1_view.up_k35, dbo.our_quote_line_1_view.daro_k35, dbo.our_quote_line_1_view.idnk08_k08, dbo.our_quote_line_1_view.idnk11_k11, dbo.our_quote_line_1_view.idnk35_k35, 
                         dbo.our_quote_line_1_view.idnk10_k10, dbo.our_quote_line_1_view.source_k09, dbo.our_quote_line_1_view.idnk31_k10, dbo.our_quote_line_1_view.idnkc4_kc4, dbo.our_quote_line_1_view.idnk33_k33, 
                         dbo.our_quote_line_1_view.clin_k35, dbo.k34_tab.*
FROM            dbo.our_quote_line_1_view INNER JOIN
                         dbo.k34_tab ON dbo.our_quote_line_1_view.idnk34_k34 = dbo.k34_tab.idnk34_k34





